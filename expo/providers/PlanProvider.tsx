import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateDailyPlan } from "@/lib/ai";
import { getRemainingEvents, getTodayEvents } from "@/lib/calendar";
import type { DayPlan } from "@/types";
import { useSettings } from "@/providers/SettingsProvider";
import { useTasks } from "@/providers/TasksProvider";

const STORAGE_KEY = "drift:plan:v1";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadPlan(): Promise<DayPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DayPlan;
  } catch {
    return null;
  }
}

async function persist(plan: DayPlan | null): Promise<void> {
  try {
    if (plan) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.log("[plan] persist error:", e);
  }
}

export const [PlanProvider, usePlan] = createContextHook(() => {
  const { settings } = useSettings();
  const { tasks, completedToday } = useTasks();
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const query = useQuery<DayPlan | null>({
    queryKey: ["plan"],
    queryFn: loadPlan,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!hydrated && query.isSuccess) {
      setPlan(query.data ?? null);
      setHydrated(true);
    }
  }, [query.data, query.isSuccess, hydrated]);

  const generateMutation = useMutation({
    mutationFn: async (opts: { reroute?: boolean } = {}) => {
      const now = new Date();
      const events = await getTodayEvents(
        settings.calendar_enabled ? settings.selected_calendar_ids : []
      );

      const reroute = opts.reroute
        ? {
            completedToday: completedToday.map((t) => t.title),
            remainingEvents: getRemainingEvents(events, now),
          }
        : undefined;

      const result = await generateDailyPlan({
        tasks,
        events,
        now,
        reroute,
      });

      const next: DayPlan = {
        id: `p_${Date.now().toString(36)}`,
        date: todayISO(),
        header_note: result.header,
        plan_items: result.items,
        calendar_context: events,
        generated_at: now.toISOString(),
        re_routed_at: opts.reroute ? now.toISOString() : null,
      };
      setPlan(next);
      persist(next);
      return next;
    },
  });

  const isToday = plan?.date === todayISO();
  const todayPlan = isToday ? plan : null;

  const clearPlan = useCallback(() => {
    setPlan(null);
    persist(null);
  }, []);

  return useMemo(
    () => ({
      plan: todayPlan,
      hydrated,
      isGenerating: generateMutation.isPending,
      generate: () => generateMutation.mutateAsync({}),
      reroute: () => generateMutation.mutateAsync({ reroute: true }),
      clearPlan,
      error: generateMutation.error as Error | null,
    }),
    [todayPlan, hydrated, generateMutation, clearPlan]
  );
});
