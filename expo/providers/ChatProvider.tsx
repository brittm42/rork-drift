import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { chatTurn } from "@/lib/ai";
import { createCalendarEvent } from "@/lib/calendar";
import { getTodayEvents } from "@/lib/calendar";
import type { ChatAction, ChatMessage, MemoryCategory, Task, Weekday } from "@/types";
import { usePlan } from "@/providers/PlanProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useSettings } from "@/providers/SettingsProvider";
import { useTasks } from "@/providers/TasksProvider";

const STORAGE_KEY = "drift:chat:v1";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function uid(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function loadMessages(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return parsed.filter((m) => new Date(m.created_at).getTime() >= cutoff);
  } catch (e) {
    console.log("[chat] load error:", e);
    return [];
  }
}

async function persist(messages: ChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (e) {
    console.log("[chat] persist error:", e);
  }
}

export const [ChatProvider, useChat] = createContextHook(() => {
  const { profile, addMemory, addAnchor, addObligation, addRule, addHousehold, addLocation } =
    useProfile();
  const { settings } = useSettings();
  const { tasks, addTask, updateTask } = useTasks();
  const { plan, reroute } = usePlan();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const query = useQuery<ChatMessage[]>({
    queryKey: ["chat"],
    queryFn: loadMessages,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (query.data && !hydrated) {
      setMessages(query.data);
      setHydrated(true);
    }
  }, [query.data, hydrated]);

  const save = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const applyAction = useCallback(
    async (action: ChatAction): Promise<void> => {
      try {
        switch (action.kind) {
          case "add_task": {
            await addTask(action.raw, {
              scheduled_for: action.scheduled_for,
              task_type: action.task_type,
              energy_level: action.energy_level,
              is_self_care: action.is_self_care,
              cadence: action.cadence,
            });
            break;
          }
          case "update_task": {
            const match = action.task_title_match.toLowerCase();
            const target = [...tasks]
              .filter((t) => !t.is_complete)
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )
              .find((t) => t.title.toLowerCase().includes(match));
            if (target) {
              const patch: Partial<Task> = { needs_classification: false, pending_question: null };
              if (action.task_type) patch.task_type = action.task_type;
              if (action.energy_level !== null) patch.energy_level = action.energy_level;
              if (action.is_self_care !== null) patch.is_self_care = action.is_self_care;
              if (action.cadence !== null) patch.cadence = action.cadence;
              updateTask(target.id, patch);
            }
            break;
          }
          case "save_memory": {
            addMemory({
              text: action.text,
              category: action.category as MemoryCategory,
              source: "chat",
            });
            break;
          }
          case "add_anchor": {
            addAnchor({
              title: action.title,
              time: action.time,
              days: action.days as Weekday[],
              buffer_minutes: action.buffer_minutes,
              location_id: null,
              notes: null,
            });
            break;
          }
          case "add_recurring": {
            addObligation({
              title: action.title,
              cadence: action.cadence,
              last_done_at: null,
              notes: null,
            });
            break;
          }
          case "add_rule": {
            addRule(action.text);
            break;
          }
          case "add_household": {
            addHousehold({
              name: action.name,
              kind: action.relation,
              detail: action.detail,
              birthday: null,
            });
            break;
          }
          case "add_location": {
            addLocation({
              label: action.label,
              address: action.address,
              latitude: null,
              longitude: null,
              notes: null,
            });
            break;
          }
          case "create_calendar_event": {
            if (Platform.OS === "web") break;
            await createCalendarEvent({
              title: action.title,
              start: new Date(action.start_time),
              end: new Date(action.end_time),
              calendarId: settings.default_write_calendar_id,
            });
            break;
          }
          case "do_reshape": {
            await reroute();
            break;
          }
          default:
            break;
        }
      } catch (e) {
        console.log("[chat] applyAction error:", e);
      }
    },
    [
      addTask,
      updateTask,
      tasks,
      addMemory,
      addAnchor,
      addObligation,
      addRule,
      addHousehold,
      addLocation,
      settings.default_write_calendar_id,
      reroute,
    ]
  );

  const sendMutation = useMutation({
    mutationFn: async (text: string): Promise<ChatMessage> => {
      const now = new Date();
      const recentTurns = messages
        .filter((m) => sameLocalDay(new Date(m.created_at), now))
        .slice(-10)
        .map((m) => ({ from: m.from, text: m.text }));

      const events = settings.calendar_enabled
        ? await getTodayEvents(settings.selected_calendar_ids)
        : plan?.calendar_context ?? [];

      const response = await chatTurn({
        userMessage: text,
        recentTurns,
        profile,
        tasks,
        events,
        planHeader: plan?.header_note ?? null,
        now,
        canWriteCalendar: settings.calendar_write_enabled,
      });

      const autoApply = response.actions.filter(
        (a) =>
          a.kind !== "propose_reshape" &&
          a.kind !== "do_reshape" &&
          a.kind !== "answer"
      );
      const appliedIds: string[] = [];
      for (let i = 0; i < response.actions.length; i++) {
        const a = response.actions[i];
        if (autoApply.includes(a)) {
          await applyAction(a);
          appliedIds.push(`${a.kind}_${i}`);
        }
      }

      const hasPropose = response.actions.some(
        (a) => a.kind === "propose_reshape" || a.kind === "do_reshape"
      );

      const botMsg: ChatMessage = {
        id: uid(),
        from: "bot",
        text: response.message,
        created_at: new Date().toISOString(),
        actions: response.actions,
        applied_action_ids: appliedIds,
        pending_confirm: hasPropose,
      };
      return botMsg;
    },
  });

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendMutation.isPending) return;
      const userMsg: ChatMessage = {
        id: uid(),
        from: "user",
        text: trimmed,
        created_at: new Date().toISOString(),
      };
      save((prev) => [...prev, userMsg]);
      try {
        const bot = await sendMutation.mutateAsync(trimmed);
        save((prev) => [...prev, bot]);
      } catch (e) {
        console.log("[chat] send error:", e);
        save((prev) => [
          ...prev,
          {
            id: uid(),
            from: "bot",
            text: "Something broke on my end. Try again in a moment.",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    },
    [sendMutation, save]
  );

  const confirmProposal = useCallback(
    async (messageId: string, accept: boolean) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !msg.pending_confirm || !msg.actions) return;
      save((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, pending_confirm: false } : m))
      );
      if (!accept) return;
      const proposal = msg.actions.find(
        (a) => a.kind === "propose_reshape" || a.kind === "do_reshape"
      );
      if (!proposal) return;
      await reroute();
      save((prev) => [
        ...prev,
        {
          id: uid(),
          from: "bot",
          text: "Done — updated your day.",
          created_at: new Date().toISOString(),
        },
      ]);
    },
    [messages, save, reroute]
  );

  const undoAction = useCallback(
    (_messageId: string, _actionIdx: number) => {
      // Lightweight undo — we don't currently track per-action state; just mark UI.
      // For now, the user can manually remove in Profile/Inbox if they change their mind.
      save((prev) =>
        prev.map((m) =>
          m.id === _messageId
            ? {
                ...m,
                applied_action_ids: (m.applied_action_ids ?? []).filter(
                  (id) => !id.endsWith(`_${_actionIdx}`)
                ),
              }
            : m
        )
      );
    },
    [save]
  );

  const clear = useCallback(() => {
    save(() => []);
  }, [save]);

  const promptFollowUp = useCallback(
    (input: { kind: "event_complete"; title: string }) => {
      const text =
        input.kind === "event_complete"
          ? `That's “${input.title}” handled. Anything that came out of it I should capture — a follow-up, a reminder, a note?`
          : "Anything you want me to capture?";
      save((prev) => [
        ...prev,
        {
          id: uid(),
          from: "bot",
          text,
          created_at: new Date().toISOString(),
        },
      ]);
    },
    [save]
  );

  // Today's messages (what's shown in the dock transcript)
  const todayMessages = useMemo(() => {
    const now = new Date();
    return messages.filter((m) => sameLocalDay(new Date(m.created_at), now));
  }, [messages]);

  return useMemo(
    () => ({
      messages,
      todayMessages,
      hydrated,
      isThinking: sendMutation.isPending,
      send,
      confirmProposal,
      undoAction,
      clear,
      promptFollowUp,
    }),
    [
      messages,
      todayMessages,
      hydrated,
      sendMutation.isPending,
      send,
      confirmProposal,
      undoAction,
      clear,
      promptFollowUp,
    ]
  );
});
