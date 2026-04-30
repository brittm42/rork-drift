import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Anchor as AnchorIcon,
  Battery,
  BatteryLow,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Flower2,
  FolderKanban,
  HelpCircle,
  Layers,
  Plus,
  Repeat,
  Sparkles,
  Sprout,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useTasks } from "@/providers/TasksProvider";
import type { Task, TaskType } from "@/types";
import { TASK_TYPE_META, TASK_TYPE_ORDER } from "@/types";

type SectionKey = Exclude<TaskType, "unclassified"> | "unclassified" | "done";

type SectionDef = {
  key: SectionKey;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  accent: string;
};

const SECTIONS: SectionDef[] = [
  {
    key: "unclassified",
    label: "Needs a quick sort",
    blurb: "Answer one question each to slot these in.",
    icon: HelpCircle,
    accent: Colors.amber,
  },
  {
    key: "fixed_anchor",
    label: TASK_TYPE_META.fixed_anchor.label,
    blurb: TASK_TYPE_META.fixed_anchor.blurb,
    icon: AnchorIcon,
    accent: Colors.sageDark,
  },
  {
    key: "committed_block",
    label: TASK_TYPE_META.committed_block.label,
    blurb: TASK_TYPE_META.committed_block.blurb,
    icon: Clock,
    accent: Colors.sageDeep,
  },
  {
    key: "floatable",
    label: TASK_TYPE_META.floatable.label,
    blurb: TASK_TYPE_META.floatable.blurb,
    icon: Layers,
    accent: Colors.sage,
  },
  {
    key: "reactive",
    label: TASK_TYPE_META.reactive.label,
    blurb: TASK_TYPE_META.reactive.blurb,
    icon: Repeat,
    accent: Colors.inkSoft,
  },
  {
    key: "aspirational",
    label: TASK_TYPE_META.aspirational.label,
    blurb: TASK_TYPE_META.aspirational.blurb,
    icon: Sprout,
    accent: Colors.sageDeep,
  },
  {
    key: "project",
    label: TASK_TYPE_META.project.label,
    blurb: TASK_TYPE_META.project.blurb,
    icon: FolderKanban,
    accent: Colors.sageDark,
  },
];

export default function DrawerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tasks, completeTask, uncompleteTask, deleteTask } = useTasks();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    done: true,
  });

  const grouped = useMemo(() => {
    const map: Record<SectionKey, Task[]> = {
      unclassified: [],
      fixed_anchor: [],
      committed_block: [],
      floatable: [],
      reactive: [],
      aspirational: [],
      project: [],
      done: [],
    };
    for (const t of tasks) {
      if (t.is_complete) {
        map.done.push(t);
        continue;
      }
      if (t.task_type === "unclassified" || t.needs_classification) {
        map.unclassified.push(t);
        continue;
      }
      map[t.task_type].push(t);
    }
    const sort = (arr: Task[]) =>
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    (Object.keys(map) as SectionKey[]).forEach((k) => sort(map[k]));
    return map;
  }, [tasks]);

  const incompleteCount = tasks.filter((t) => !t.is_complete).length;
  const selfCareCount = tasks.filter(
    (t) => !t.is_complete && t.is_self_care
  ).length;

  const toggleSection = useCallback((key: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const handleToggle = useCallback(
    (task: Task) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (task.is_complete) uncompleteTask(task.id);
      else completeTask(task.id);
    },
    [completeTask, uncompleteTask]
  );

  const handleDelete = useCallback(
    (task: Task) => {
      if (Platform.OS === "web") {
        deleteTask(task.id);
        return;
      }
      Alert.alert("Delete this?", task.title, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteTask(task.id) },
      ]);
    },
    [deleteTask]
  );

  const sectionData = useMemo(() => {
    const defs: SectionDef[] = [...SECTIONS];
    const doneDef: SectionDef = {
      key: "done",
      label: "Done",
      blurb: "Recently finished.",
      icon: Check,
      accent: Colors.inkMuted,
    };
    return [...defs, doneDef].filter((s) => grouped[s.key].length > 0);
  }, [grouped]);

  const hasAny = tasks.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>STUFF DRAWER</Text>
          <Text style={styles.title}>
            {incompleteCount}{" "}
            <Text style={styles.titleSub}>
              {incompleteCount === 1 ? "thing" : "things"}
            </Text>
          </Text>
          {selfCareCount > 0 && (
            <View style={styles.selfCareBadge}>
              <Flower2 size={11} color={Colors.sageDeep} strokeWidth={2} />
              <Text style={styles.selfCareText}>
                {selfCareCount} for you
              </Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            router.push("/add-task");
          }}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { transform: [{ scale: 0.92 }], opacity: 0.85 },
          ]}
          testID="drawer-fab"
          hitSlop={8}
        >
          <Plus size={20} color={Colors.paper} strokeWidth={2.5} />
        </Pressable>
      </View>

      <FlatList
        data={sectionData}
        keyExtractor={(s) => s.key}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
        ListEmptyComponent={
          hasAny ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>The drawer&apos;s empty.</Text>
              <Text style={styles.emptyBody}>
                Everyone has one. Tell me what&apos;s on your mind in chat, or
                tap + to drop something in.
              </Text>
            </View>
          )
        }
        renderItem={({ item: section }) => {
          const items = grouped[section.key];
          const isCollapsed = collapsed[section.key] ?? false;
          const Icon = section.icon;
          return (
            <View style={styles.section}>
              <Pressable
                onPress={() => toggleSection(section.key)}
                style={({ pressed }) => [
                  styles.sectionHead,
                  pressed && { opacity: 0.7 },
                ]}
                testID={`drawer-section-${section.key}`}
              >
                <View
                  style={[styles.sectionIcon, { backgroundColor: `${section.accent}22` }]}
                >
                  <Icon size={13} color={section.accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>
                    {section.label}
                    <Text style={styles.sectionCount}>  {items.length}</Text>
                  </Text>
                  {!isCollapsed && (
                    <Text style={styles.sectionBlurb}>{section.blurb}</Text>
                  )}
                </View>
                {isCollapsed ? (
                  <ChevronRight size={16} color={Colors.inkMuted} strokeWidth={2} />
                ) : (
                  <ChevronDown size={16} color={Colors.inkMuted} strokeWidth={2} />
                )}
              </Pressable>

              {!isCollapsed && (
                <View style={styles.sectionBody}>
                  {items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={() => handleToggle(t)}
                      onDelete={() => handleDelete(t)}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />

    </View>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const meta: string[] = [];
  if (task.energy_level === "deep") meta.push("deep focus");
  else if (task.energy_level === "light") meta.push("low-lift");
  if (task.cadence) meta.push(task.cadence);
  if (task.is_self_care) meta.push("for you");

  return (
    <View style={styles.row}>
      <Pressable onPress={onToggle} style={styles.checkHit} hitSlop={6}>
        <View style={[styles.checkBox, task.is_complete && styles.checkBoxDone]}>
          {task.is_complete ? (
            <Check size={12} color={Colors.paper} strokeWidth={3} />
          ) : null}
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.taskText, task.is_complete && styles.taskTextDone]}
        >
          {task.title}
        </Text>
        {task.pending_question && !task.is_complete && (
          <View style={styles.questionRow}>
            <Sparkles size={10} color={Colors.amber} strokeWidth={2} />
            <Text style={styles.questionText} numberOfLines={2}>
              {task.pending_question}
            </Text>
          </View>
        )}
        {meta.length > 0 && !task.is_complete && (
          <View style={styles.metaRow}>
            {task.energy_level === "deep" && (
              <Battery size={10} color={Colors.inkMuted} strokeWidth={2} />
            )}
            {task.energy_level === "light" && (
              <BatteryLow size={10} color={Colors.inkMuted} strokeWidth={2} />
            )}
            <Text style={styles.metaText}>{meta.join(" · ")}</Text>
          </View>
        )}
      </View>
      <Pressable onPress={onDelete} style={styles.delBtn} hitSlop={10}>
        <Trash2 size={14} color={Colors.inkFaint} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2.2,
    color: Colors.inkMuted,
    fontWeight: "600",
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -0.8,
  },
  titleSub: {
    fontSize: 18,
    color: Colors.inkMuted,
    fontWeight: "500",
  },
  selfCareBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Colors.creamSoft,
    alignSelf: "flex-start",
  },
  selfCareText: {
    fontSize: 11,
    color: Colors.sageDeep,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  section: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: Colors.paper,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.inkMuted,
    letterSpacing: 0.2,
  },
  sectionBlurb: {
    fontSize: 11.5,
    color: Colors.inkMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSoft,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    gap: 12,
  },
  checkHit: { paddingTop: 2 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxDone: {
    backgroundColor: Colors.sageDeep,
    borderColor: Colors.sageDeep,
  },
  taskText: {
    fontSize: 15,
    color: Colors.ink,
    lineHeight: 20,
    fontWeight: "500",
  },
  taskTextDone: {
    color: Colors.inkMuted,
    textDecorationLine: "line-through",
  },
  questionRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    backgroundColor: Colors.creamSoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  questionText: {
    fontSize: 11.5,
    color: Colors.sageDark,
    fontStyle: "italic",
    flexShrink: 1,
    lineHeight: 15,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  metaText: {
    fontSize: 11,
    color: Colors.inkMuted,
    letterSpacing: 0.2,
    fontWeight: "500",
  },
  delBtn: { padding: 6 },
  empty: {
    paddingTop: 64,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.inkSoft,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.sageDeep,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
});
