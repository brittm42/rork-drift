import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseTaskInput } from "@/lib/ai";
import type { Task } from "@/types";

function defaultTaskFields(): Omit<Task, "id" | "raw_input" | "title" | "urgency_flag" | "created_at"> {
  return {
    is_complete: false,
    completed_at: null,
    last_surfaced_at: null,
    snooze_until: null,
    recurrence_rule: null,
    due_date: null,
    scheduled_for: null,
    task_type: "unclassified",
    energy_level: null,
    window_start: null,
    window_end: null,
    is_self_care: false,
    is_protected: false,
    parent_task_id: null,
    cadence: null,
    needs_classification: true,
    pending_question: null,
  };
}

function withDefaults(t: Partial<Task> & Pick<Task, "id" | "title" | "created_at">): Task {
  return {
    raw_input: t.raw_input ?? t.title,
    urgency_flag: t.urgency_flag ?? false,
    ...defaultTaskFields(),
    ...t,
  } as Task;
}
import { useProfile } from "@/providers/ProfileProvider";

const STORAGE_KEY = "drift:tasks:v1";

function uid(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Task[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => withDefaults(t));
  } catch (e) {
    console.log("[tasks] load error:", e);
    return [];
  }
}

async function persist(tasks: Task[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.log("[tasks] persist error:", e);
  }
}

export const [TasksProvider, useTasks] = createContextHook(() => {
  const { profile } = useProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const query = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: loadTasks,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (query.data && !hydrated) {
      setTasks(query.data);
      setHydrated(true);
    }
  }, [query.data, hydrated]);

  const save = useCallback((next: Task[]) => {
    setTasks(next);
    persist(next);
  }, []);

  const addMutation = useMutation({
    mutationFn: async (raw: string) => parseTaskInput(raw, profile),
  });

  const addTask = useCallback(
    async (
      raw: string,
      opts?: {
        scheduled_for?: Task["scheduled_for"];
        task_type?: Task["task_type"];
        energy_level?: Task["energy_level"];
        is_self_care?: boolean;
        cadence?: string | null;
        parent_task_id?: string | null;
        skipAiParse?: boolean;
      }
    ): Promise<Task> => {
      const trimmed = raw.trim();
      if (!trimmed) throw new Error("empty");
      const now = new Date().toISOString();
      const optimistic: Task = withDefaults({
        id: uid(),
        raw_input: trimmed,
        title: trimmed,
        urgency_flag: /\b(today|urgent|asap|now|immediately|by)\b/i.test(trimmed),
        created_at: now,
        scheduled_for: opts?.scheduled_for ?? null,
        task_type: opts?.task_type ?? "unclassified",
        energy_level: opts?.energy_level ?? null,
        is_self_care: opts?.is_self_care ?? false,
        cadence: opts?.cadence ?? null,
        parent_task_id: opts?.parent_task_id ?? null,
        needs_classification: !opts?.task_type || opts.task_type === "unclassified",
      });
      setTasks((prev) => {
        const next = [optimistic, ...prev];
        persist(next);
        return next;
      });

      if (opts?.skipAiParse) return optimistic;

      try {
        const parsed = await addMutation.mutateAsync(trimmed);
        const resolvedType: Task["task_type"] =
          opts?.task_type && opts.task_type !== "unclassified"
            ? opts.task_type
            : parsed.task_type ?? "unclassified";
        setTasks((prev) => {
          const next = prev.map((t) =>
            t.id === optimistic.id
              ? {
                  ...t,
                  title: parsed.title,
                  urgency_flag: parsed.urgency_flag,
                  task_type: resolvedType,
                  energy_level: t.energy_level ?? parsed.energy_level ?? null,
                  is_self_care: t.is_self_care || parsed.is_self_care === true,
                  cadence: t.cadence ?? parsed.cadence ?? null,
                  pending_question: parsed.clarifying_question ?? null,
                  needs_classification:
                    resolvedType === "unclassified" || !!parsed.clarifying_question,
                }
              : t
          );
          persist(next);
          return next;
        });
        return {
          ...optimistic,
          title: parsed.title,
          urgency_flag: parsed.urgency_flag,
          task_type: resolvedType,
          energy_level: optimistic.energy_level ?? parsed.energy_level ?? null,
          is_self_care: optimistic.is_self_care || parsed.is_self_care === true,
          cadence: optimistic.cadence ?? parsed.cadence ?? null,
          pending_question: parsed.clarifying_question ?? null,
          needs_classification:
            resolvedType === "unclassified" || !!parsed.clarifying_question,
        };
      } catch (e) {
        console.log("[tasks] AI parse failed, keeping raw:", e);
        return optimistic;
      }
    },
    [addMutation]
  );

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      persist(next);
      return next;
    });
  }, []);

  const completeTask = useCallback((id: string) => {
    const now = new Date().toISOString();
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, is_complete: true, completed_at: now } : t
      );
      persist(next);
      return next;
    });
  }, []);

  const uncompleteTask = useCallback((id: string) => {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, is_complete: false, completed_at: null } : t
      );
      persist(next);
      return next;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const byId = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const incomplete = useMemo(() => tasks.filter((t) => !t.is_complete), [tasks]);

  const completedToday = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    return tasks.filter((t) => {
      if (!t.completed_at) return false;
      const c = new Date(t.completed_at);
      return c.getFullYear() === y && c.getMonth() === m && c.getDate() === d;
    });
  }, [tasks]);

  return useMemo(
    () => ({
      tasks,
      incomplete,
      completedToday,
      byId,
      hydrated,
      addTask,
      updateTask,
      completeTask,
      uncompleteTask,
      deleteTask,
      save,
    }),
    [tasks, incomplete, completedToday, byId, hydrated, addTask, updateTask, completeTask, uncompleteTask, deleteTask, save]
  );
});
