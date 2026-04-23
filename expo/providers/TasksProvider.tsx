import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseTaskInput } from "@/lib/ai";
import type { Task } from "@/types";
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
    return Array.isArray(parsed) ? parsed : [];
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
    async (raw: string): Promise<Task> => {
      const trimmed = raw.trim();
      if (!trimmed) throw new Error("empty");
      const now = new Date().toISOString();
      const optimistic: Task = {
        id: uid(),
        raw_input: trimmed,
        title: trimmed,
        urgency_flag: /\b(today|urgent|asap|now|immediately|by)\b/i.test(trimmed),
        is_complete: false,
        completed_at: null,
        created_at: now,
        last_surfaced_at: null,
        snooze_until: null,
        recurrence_rule: null,
        due_date: null,
      };
      setTasks((prev) => {
        const next = [optimistic, ...prev];
        persist(next);
        return next;
      });

      try {
        const parsed = await addMutation.mutateAsync(trimmed);
        setTasks((prev) => {
          const next = prev.map((t) =>
            t.id === optimistic.id
              ? { ...t, title: parsed.title, urgency_flag: parsed.urgency_flag }
              : t
          );
          persist(next);
          return next;
        });
        return { ...optimistic, title: parsed.title, urgency_flag: parsed.urgency_flag };
      } catch (e) {
        console.log("[tasks] AI parse failed, keeping raw:", e);
        return optimistic;
      }
    },
    [addMutation]
  );

  const completeTask = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setTasks((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, is_complete: true, completed_at: now } : t
        );
        persist(next);
        return next;
      });
    },
    []
  );

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
      completeTask,
      uncompleteTask,
      deleteTask,
      save,
    }),
    [tasks, incomplete, completedToday, byId, hydrated, addTask, completeTask, uncompleteTask, deleteTask, save]
  );
});
