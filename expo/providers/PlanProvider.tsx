import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateDailyPlan } from "@/lib/ai";
import { getRemainingEvents, getTodayEvents } from "@/lib/calendar";
import type { DayPlan } from "@/types";
import { useSettings } from "@/providers/SettingsProvider";
import { useTasks } from "@/providers/TasksProvider";
import { useProfile } from "@/providers/ProfileProvider";

const STORAGE_KEY = "drift:plan:v1";
const EVENT_STATE_KEY = "drift:event-states:v1";

type EventStateMap = Record<string, "done" | "skipped">;
type StoredEventStates = { date: string; states: EventStateMap };

async function loadEventStates(): Promise<StoredEventStates | null> {
  try {
    const raw = await AsyncStorage.getItem(EVENT_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredEventStates;
  } catch {
    return null;
  }
}

async function persistEventStates(v: StoredEventStates | null): Promise<void> {
  try {
    if (v) await AsyncStorage.setItem(EVENT_STATE_KEY, JSON.stringify(v));
    else await AsyncStorage.removeItem(EVENT_STATE_KEY);
  } catch (e) {
    console.log("[plan] event states persist error:", e);
  }
}

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
  const { settings, update: updateSettings } = useSettings();
  const { tasks, completedToday, hydrated: tasksHydrated } = useTasks();
  const { profile, hydrated: profileHydrated } = useProfile();
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [autoTried, setAutoTried] = useState<boolean>(false);
  const [eventStates, setEventStates] = useState<EventStateMap>({});

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

  useEffect(() => {
    loadEventStates().then((stored) => {
      if (stored && stored.date === todayISO()) {
        setEventStates(stored.states);
      } else if (stored) {
        persistEventStates(null);
      }
    });
  }, []);

  const setEventState = useCallback(
    (eventId: string, state: "done" | "skipped" | null) => {
      setEventStates((prev) => {
        const next = { ...prev };
        if (state === null) delete next[eventId];
        else next[eventId] = state;
        persistEventStates({ date: todayISO(), states: next });
        return next;
      });
    },
    []
  );

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
        profile,
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

  // Safety-net auto-generation: if today's plan is missing when the app
  // opens, generate quietly (no duplicate notification). This backs up the
  // morning-of scheduled generation in case the device was off at 7:28.
  useEffect(() => {
    if (!hydrated || !tasksHydrated || !profileHydrated) return;
    if (autoTried) return;
    const today = todayISO();
    if (plan?.date === today) {
      setAutoTried(true);
      return;
    }
    if (settings.last_auto_plan_date === today) {
      setAutoTried(true);
      return;
    }
    const incompleteCount = tasks.filter((t) => !t.is_complete).length;
    if (incompleteCount === 0) {
      setAutoTried(true);
      return;
    }
    setAutoTried(true);
    console.log("[plan] auto-generating today's plan (safety net)");
    generateMutation
      .mutateAsync({})
      .then(() => updateSettings({ last_auto_plan_date: today }))
      .catch((e) => console.log("[plan] auto-generate failed:", e));
  }, [
    hydrated,
    tasksHydrated,
    profileHydrated,
    autoTried,
    plan?.date,
    settings.last_auto_plan_date,
    tasks,
    generateMutation,
    updateSettings,
  ]);

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
      eventStates,
      setEventState,
    }),
    [todayPlan, hydrated, generateMutation, clearPlan, eventStates, setEventState]
  );
});
