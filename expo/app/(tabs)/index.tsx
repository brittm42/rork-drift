import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check, Plus, RefreshCw, Sparkles } from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
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
import { useSettings } from "@/providers/SettingsProvider";
import { useTasks } from "@/providers/TasksProvider";
import type { PlanItem, Task } from "@/types";
import { CapabilityCard } from "@/components/CapabilityCard";

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

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, generate, reroute, isGenerating, error } = usePlan();
  const { incomplete, completedToday, byId, completeTask, uncompleteTask } = useTasks();
  const { settings } = useSettings();

  const planTasks = useMemo(() => {
    if (!plan) return [] as { item: PlanItem; task: Task }[];
    return plan.plan_items
      .map((item) => {
        const task = byId.get(item.task_id);
        return task ? { item, task } : null;
      })
      .filter((x): x is { item: PlanItem; task: Task } => x !== null);
  }, [plan, byId]);

  const activePlanTasks = planTasks.filter((p) => !p.task.is_complete);
  const donePlanTasks = planTasks.filter((p) => p.task.is_complete);

  const handleGenerate = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    try {
      await generate();
    } catch (e) {
      console.log("[today] generate error:", e);
    }
  }, [generate]);

  const handleReroute = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await reroute();
    } catch (e) {
      console.log("[today] reroute error:", e);
    }
  }, [reroute]);

  const handleComplete = useCallback(
    (taskId: string, isComplete: boolean) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (isComplete) uncompleteTask(taskId);
      else completeTask(taskId);
    },
    [completeTask, uncompleteTask]
  );

  const allDone = plan && activePlanTasks.length === 0 && planTasks.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 140,
          paddingHorizontal: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleGenerate}
            tintColor={Colors.sageDeep}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{formatToday().toUpperCase()}</Text>
        <Text style={styles.greeting}>{greeting()}.</Text>

        <CapabilityCard />

        {plan ? (
          <>
            <View style={styles.headerCard}>
              <Sparkles size={14} color={Colors.sageDeep} strokeWidth={2} />
              <Text style={styles.headerCardText}>{plan.header_note}</Text>
            </View>

            {plan.calendar_context.length > 0 && (
              <View style={styles.calendarStrip}>
                <Text style={styles.calendarStripLabel}>On your calendar</Text>
                {plan.calendar_context.slice(0, 4).map((e) => (
                  <View key={e.id} style={styles.calendarEvent}>
                    <View style={styles.calendarDot} />
                    <Text style={styles.calendarEventTime} numberOfLines={1}>
                      {e.all_day
                        ? "All day"
                        : new Date(e.start_time).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </Text>
                    <Text style={styles.calendarEventTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.progressRow}>
              <Text style={styles.progressCount}>
                {completedToday.length} <Text style={styles.progressLabel}>done today</Text>
              </Text>
              {plan.re_routed_at && (
                <Text style={styles.rerouteLabel}>Re-routed</Text>
              )}
            </View>

            {allDone ? (
              <View style={styles.doneCard}>
                <Text style={styles.doneEmoji}>·</Text>
                <Text style={styles.doneTitle}>You&apos;re done for today</Text>
                <Text style={styles.doneSub}>
                  Everything Drift mapped out is handled. Rest, or add something new.
                </Text>
              </View>
            ) : (
              <View style={styles.planList}>
                {activePlanTasks.map(({ item, task }, idx) => (
                  <PlanRow
                    key={task.id}
                    index={idx}
                    item={item}
                    task={task}
                    onToggle={() => handleComplete(task.id, task.is_complete)}
                    testId={`plan-row-${idx}`}
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

            <Pressable
              onPress={handleReroute}
              disabled={isGenerating}
              style={({ pressed }) => [
                styles.rerouteBtn,
                pressed && { opacity: 0.7 },
                isGenerating && { opacity: 0.5 },
              ]}
              testID="reroute-btn"
            >
              {isGenerating ? (
                <ActivityIndicator color={Colors.sageDeep} />
              ) : (
                <>
                  <RefreshCw size={15} color={Colors.sageDeep} strokeWidth={1.75} />
                  <Text style={styles.rerouteBtnText}>Re-route my day</Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <EmptyState
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            hasTasks={incomplete.length > 0}
            calendarEnabled={settings.calendar_enabled}
            error={error}
          />
        )}
      </ScrollView>

      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          router.push("/add-task");
        }}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 92 },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
        testID="fab-add"
      >
        <Plus size={22} color={Colors.paper} strokeWidth={2.25} />
      </Pressable>
    </View>
  );
}

function PlanRow({
  index,
  item,
  task,
  onToggle,
  testId,
}: {
  index: number;
  item: PlanItem;
  task: Task;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <View style={styles.planRow}>
      <Pressable onPress={onToggle} style={styles.checkHit} testID={testId}>
        <View style={styles.checkBox}>
          {task.urgency_flag && <View style={styles.urgencyDot} />}
        </View>
      </Pressable>
      <View style={styles.planRowBody}>
        <View style={styles.planRowHead}>
          <Text style={styles.timeWindow}>{item.suggested_time_window}</Text>
          {task.urgency_flag && <Text style={styles.urgentLabel}>urgent</Text>}
        </View>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <Text style={styles.rationale}>{item.rationale}</Text>
      </View>
      <Text style={styles.planIndex}>{String(index + 1).padStart(2, "0")}</Text>
    </View>
  );
}

function EmptyState({
  onGenerate,
  isGenerating,
  hasTasks,
  calendarEnabled,
  error,
}: {
  onGenerate: () => void;
  isGenerating: boolean;
  hasTasks: boolean;
  calendarEnabled: boolean;
  error: Error | null;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyGlyph}>
        <View style={styles.emptyLine} />
      </View>
      <Text style={styles.emptyTitle}>
        {hasTasks ? "Ready when you are." : "Nothing on deck."}
      </Text>
      <Text style={styles.emptyBody}>
        {hasTasks
          ? calendarEnabled
            ? "Drift will read your calendar and write a plan that fits around it."
            : "Drift will plan the day from what's in your inbox."
          : "Add a task from the + button, then Drift will draw up a plan."}
      </Text>
      {error && <Text style={styles.errorText}>Couldn&apos;t generate a plan. Tap to try again.</Text>}
      <Pressable
        onPress={onGenerate}
        disabled={isGenerating || !hasTasks}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { opacity: 0.8 },
          (isGenerating || !hasTasks) && { opacity: 0.4 },
        ]}
        testID="generate-plan-btn"
      >
        {isGenerating ? (
          <>
            <ActivityIndicator color={Colors.paper} />
            <Text style={styles.primaryBtnText}>Drift is thinking…</Text>
          </>
        ) : (
          <>
            <Sparkles size={16} color={Colors.paper} strokeWidth={2} />
            <Text style={styles.primaryBtnText}>Plan my day</Text>
          </>
        )}
      </Pressable>
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
  headerCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: Colors.creamSoft,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  headerCardText: {
    flex: 1,
    fontSize: 15,
    color: Colors.sageDark,
    lineHeight: 22,
    fontWeight: "500",
  },
  calendarStrip: {
    marginBottom: 20,
  },
  calendarStripLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.inkMuted,
    fontWeight: "600",
    marginBottom: 8,
  },
  calendarEvent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.sage,
  },
  calendarEventTime: {
    fontSize: 12,
    color: Colors.inkSoft,
    fontVariant: ["tabular-nums"],
    width: 74,
  },
  calendarEventTitle: {
    flex: 1,
    fontSize: 13,
    color: Colors.inkSoft,
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
  planList: {
    gap: 4,
  },
  planRow: {
    flexDirection: "row",
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 14,
  },
  checkHit: {
    paddingTop: 22,
    paddingRight: 4,
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
  planRowBody: {
    flex: 1,
  },
  planRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  timeWindow: {
    fontSize: 11,
    letterSpacing: 1.3,
    color: Colors.sageDeep,
    fontWeight: "700",
  },
  urgentLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.urgent,
    fontWeight: "700",
  },
  taskTitle: {
    fontSize: 19,
    color: Colors.ink,
    fontWeight: "600",
    letterSpacing: -0.3,
    lineHeight: 25,
    marginBottom: 4,
  },
  rationale: {
    fontSize: 13,
    color: Colors.inkSoft,
    lineHeight: 19,
    fontStyle: "italic",
  },
  planIndex: {
    fontSize: 11,
    color: Colors.inkFaint,
    fontWeight: "600",
    letterSpacing: 1,
    paddingTop: 22,
    fontVariant: ["tabular-nums"],
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
  doneCard: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 12,
  },
  doneEmoji: {
    fontSize: 40,
    color: Colors.sageDeep,
    marginBottom: 4,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: Colors.ink,
    letterSpacing: -0.4,
  },
  doneSub: {
    fontSize: 14,
    color: Colors.inkSoft,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  rerouteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  rerouteBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.sageDeep,
    letterSpacing: 0.2,
  },
  empty: {
    paddingTop: 40,
    alignItems: "center",
    gap: 14,
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
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: Colors.urgent,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.sageDeep,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 10,
  },
  primaryBtnText: {
    color: Colors.paper,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  fab: {
    position: "absolute",
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.sageDeep,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
});
