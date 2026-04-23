import * as Haptics from "expo-haptics";
import {
  Anchor as AnchorIcon,
  Calendar as CalendarIcon,
  Check,
} from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { usePlan } from "@/providers/PlanProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useSettings } from "@/providers/SettingsProvider";
import { useTasks } from "@/providers/TasksProvider";
import type {
  Anchor,
  CalendarEventSnapshot,
  PlanItem,
  Task,
  Weekday,
} from "@/types";
import { CapabilityCard } from "@/components/CapabilityCard";
import { ChatDock } from "@/components/ChatDock";
import { formatDate, formatHHMM, minutesOfDay } from "@/lib/time";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const WEEKDAY_KEYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function todayWeekday(): Weekday {
  return WEEKDAY_KEYS[new Date().getDay()];
}

type TimelineItem =
  | {
      kind: "event";
      id: string;
      title: string;
      sortMinutes: number;
      allDay: boolean;
      timeLabel: string;
      event: CalendarEventSnapshot;
    }
  | {
      kind: "anchor";
      id: string;
      title: string;
      sortMinutes: number;
      timeLabel: string;
      anchor: Anchor;
    }
  | {
      kind: "task";
      id: string;
      title: string;
      sortMinutes: number;
      timeLabel: string;
      task: Task;
      item: PlanItem;
      index: number;
    };

function buildTimeline(params: {
  events: CalendarEventSnapshot[];
  anchors: Anchor[];
  planTasks: { item: PlanItem; task: Task }[];
  timeFormat: "12h" | "24h";
}): TimelineItem[] {
  const { events, anchors, planTasks, timeFormat } = params;
  const dayKey = todayWeekday();
  const items: TimelineItem[] = [];

  for (const e of events) {
    if (e.all_day) {
      items.push({
        kind: "event",
        id: `e_${e.id}`,
        title: e.title,
        sortMinutes: -1,
        allDay: true,
        timeLabel: "All day",
        event: e,
      });
    } else {
      const d = new Date(e.start_time);
      const mins = d.getHours() * 60 + d.getMinutes();
      items.push({
        kind: "event",
        id: `e_${e.id}`,
        title: e.title,
        sortMinutes: mins,
        allDay: false,
        timeLabel: formatDate(d, timeFormat),
        event: e,
      });
    }
  }

  for (const a of anchors) {
    if (!a.days.includes(dayKey)) continue;
    const mins = a.time ? minutesOfDay(a.time) : 24 * 60 + 1;
    items.push({
      kind: "anchor",
      id: `a_${a.id}`,
      title: a.title,
      sortMinutes: mins,
      timeLabel: a.time ? formatHHMM(a.time, timeFormat) : "Anytime",
      anchor: a,
    });
  }

  planTasks.forEach(({ item, task }, idx) => {
    const t = item.start_time;
    const mins = t ? minutesOfDay(t) : 24 * 60 + 2 + idx;
    items.push({
      kind: "task",
      id: `t_${task.id}`,
      title: task.title,
      sortMinutes: mins,
      timeLabel: t ? formatHHMM(t, timeFormat) : item.suggested_time_window,
      task,
      item,
      index: idx,
    });
  });

  items.sort((a, b) => a.sortMinutes - b.sortMinutes);
  return items;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { plan, generate, isGenerating } = usePlan();
  const { completedToday, byId, completeTask, uncompleteTask } = useTasks();
  const { settings } = useSettings();
  const { profile } = useProfile();

  const planTasks = useMemo(() => {
    if (!plan) return [] as { item: PlanItem; task: Task }[];
    return plan.plan_items
      .map((item) => {
        const task = byId.get(item.task_id);
        return task ? { item, task } : null;
      })
      .filter((x): x is { item: PlanItem; task: Task } => x !== null);
  }, [plan, byId]);

  const activePlanTasks = useMemo(
    () => planTasks.filter((p) => !p.task.is_complete),
    [planTasks]
  );
  const donePlanTasks = useMemo(
    () => planTasks.filter((p) => p.task.is_complete),
    [planTasks]
  );

  const timeline = useMemo(
    () =>
      buildTimeline({
        events: plan?.calendar_context ?? [],
        anchors: profile.anchors,
        planTasks: activePlanTasks,
        timeFormat: settings.time_format,
      }),
    [plan?.calendar_context, profile.anchors, activePlanTasks, settings.time_format]
  );

  const allDayItems = useMemo(
    () => timeline.filter((i) => i.kind === "event" && i.allDay),
    [timeline]
  );
  const timedItems = useMemo(
    () => timeline.filter((i) => !(i.kind === "event" && i.allDay)),
    [timeline]
  );

  const handleGenerate = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    try {
      await generate();
    } catch (e) {
      console.log("[today] generate error:", e);
    }
  }, [generate]);

  const handleComplete = useCallback(
    (taskId: string, isComplete: boolean) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isComplete) uncompleteTask(taskId);
      else completeTask(taskId);
    },
    [completeTask, uncompleteTask]
  );

  const hasPlanContext = !!plan || profile.anchors.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 260,
          paddingHorizontal: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isGenerating}
            onRefresh={handleGenerate}
            tintColor={Colors.sageDeep}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{formatToday().toUpperCase()}</Text>
        <Text style={styles.greeting}>{greeting()}.</Text>

        <CapabilityCard />

        {!hasPlanContext ? (
          <EmptyState isGenerating={isGenerating} />
        ) : (
          <>
            <View style={styles.progressRow}>
              <Text style={styles.progressCount}>
                {completedToday.length}{" "}
                <Text style={styles.progressLabel}>done today</Text>
              </Text>
              {plan?.re_routed_at && <Text style={styles.rerouteLabel}>Re-routed</Text>}
            </View>

            <Text style={styles.sectionLabel}>ON YOUR PLATE TODAY</Text>

            {timeline.length === 0 ? (
              <Text style={styles.emptyTimeline}>
                Nothing scheduled yet. Add something in the chat below.
              </Text>
            ) : (
              <View style={styles.timelineList}>
                {allDayItems.map((b) => (
                  <TimelineRow
                    key={b.id}
                    item={b}
                    onToggle={handleComplete}
                  />
                ))}
                {timedItems.map((b) => (
                  <TimelineRow
                    key={b.id}
                    item={b}
                    onToggle={handleComplete}
                  />
                ))}
              </View>
            )}

            {donePlanTasks.length > 0 && (
              <View style={styles.doneSection}>
                <Text style={styles.doneHeading}>Completed</Text>
                {donePlanTasks.map(({ task }) => (
                  <Pressable
                    key={task.id}
                    onPress={() => handleComplete(task.id, true)}
                    style={styles.doneRow}
                  >
                    <View style={styles.checkBoxDone}>
                      <Check size={12} color={Colors.paper} strokeWidth={3} />
                    </View>
                    <Text style={styles.doneRowText} numberOfLines={1}>
                      {task.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ChatDock planHeader={plan?.header_note ?? null} />
    </View>
  );
}

function TimelineRow({
  item,
  onToggle,
}: {
  item: TimelineItem;
  onToggle: (taskId: string, isComplete: boolean) => void;
}) {
  if (item.kind === "task") {
    const task = item.task;
    return (
      <View style={styles.row}>
        <Pressable
          onPress={() => onToggle(task.id, task.is_complete)}
          style={styles.rowCheckHit}
          testID={`timeline-task-${task.id}`}
        >
          <View style={styles.checkBox}>
            {task.urgency_flag && <View style={styles.urgencyDot} />}
          </View>
        </Pressable>
        <View style={styles.rowBody}>
          <View style={styles.rowMeta}>
            <Text style={styles.rowTime}>{item.timeLabel}</Text>
            {task.urgency_flag && <Text style={styles.urgentTag}>urgent</Text>}
          </View>
          <Text style={styles.rowTitle}>{item.title}</Text>
          {item.item.rationale && (
            <Text style={styles.rowSub}>{item.item.rationale}</Text>
          )}
        </View>
      </View>
    );
  }

  const isAnchor = item.kind === "anchor";
  const Icon = isAnchor ? AnchorIcon : CalendarIcon;
  const tagText = isAnchor ? "anchor" : "event";

  return (
    <View style={styles.row}>
      <View style={styles.rowIconHit}>
        <View style={styles.iconDot}>
          <Icon size={11} color={Colors.sageDeep} strokeWidth={2} />
        </View>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <Text style={styles.rowTime}>{item.timeLabel}</Text>
          <Text style={styles.ghostTag}>{tagText}</Text>
        </View>
        <Text style={styles.rowTitleMuted}>{item.title}</Text>
      </View>
    </View>
  );
}

function EmptyState({ isGenerating }: { isGenerating: boolean }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyGlyph}>
        <View style={styles.emptyLine} />
      </View>
      <Text style={styles.emptyTitle}>
        {isGenerating ? "Thinking through your day…" : "Nothing on deck."}
      </Text>
      <Text style={styles.emptyBody}>
        {isGenerating
          ? "Pulling your calendar and shaping the morning."
          : "Tell me something in the chat below — I'll take it from there."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.inkMuted,
    fontWeight: "600",
    marginBottom: 10,
  },
  greeting: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -0.8,
    marginBottom: 22,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  progressCount: {
    fontSize: 22,
    color: Colors.sageDeep,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.inkMuted,
    fontWeight: "500",
  },
  rerouteLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.amber,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: Colors.inkMuted,
    fontWeight: "700",
    marginBottom: 12,
  },
  emptyTimeline: {
    fontSize: 13,
    color: Colors.inkMuted,
    fontStyle: "italic",
    paddingVertical: 10,
  },
  timelineList: {},
  row: {
    flexDirection: "row",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 14,
  },
  rowCheckHit: { paddingTop: 20, paddingRight: 2 },
  rowIconHit: {
    paddingTop: 20,
    paddingRight: 2,
    alignItems: "center",
    width: 22,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.urgent,
  },
  iconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1 },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  rowTime: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.sageDeep,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  urgentTag: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.urgent,
    fontWeight: "700",
  },
  ghostTag: {
    fontSize: 9,
    letterSpacing: 1.3,
    color: Colors.inkMuted,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  rowTitle: {
    fontSize: 18,
    color: Colors.ink,
    fontWeight: "600",
    letterSpacing: -0.2,
    lineHeight: 24,
    marginBottom: 3,
  },
  rowTitleMuted: {
    fontSize: 16,
    color: Colors.inkSoft,
    fontWeight: "500",
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  rowSub: {
    fontSize: 13,
    color: Colors.inkSoft,
    lineHeight: 18,
    fontStyle: "italic",
  },
  doneSection: {
    marginTop: 28,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  doneHeading: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.inkMuted,
    fontWeight: "700",
    marginBottom: 10,
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  checkBoxDone: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.sageDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  doneRowText: {
    flex: 1,
    fontSize: 14,
    color: Colors.inkMuted,
    textDecorationLine: "line-through",
  },
  empty: {
    paddingTop: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyGlyph: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyLine: {
    width: 28,
    height: 2,
    backgroundColor: Colors.sageDeep,
    borderRadius: 1,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: Colors.ink,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.inkSoft,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
});
