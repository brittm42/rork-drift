import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check, Plus, Trash2 } from "lucide-react-native";
import React, { useCallback, useState } from "react";
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
import type { Task } from "@/types";

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tasks, completeTask, uncompleteTask, deleteTask } = useTasks();
  const [showDone, setShowDone] = useState<boolean>(false);

  const visible = showDone ? tasks : tasks.filter((t) => !t.is_complete);
  const sorted = [...visible].sort((a, b) => {
    if (a.is_complete !== b.is_complete) return a.is_complete ? 1 : -1;
    if (a.urgency_flag !== b.urgency_flag) return a.urgency_flag ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const incompleteCount = tasks.filter((t) => !t.is_complete).length;

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
      Alert.alert("Delete this task?", task.title, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteTask(task.id) },
      ]);
    },
    [deleteTask]
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.eyebrow}>INBOX</Text>
          <Text style={styles.title}>
            {incompleteCount} <Text style={styles.titleSub}>{incompleteCount === 1 ? "task" : "tasks"}</Text>
          </Text>
        </View>
        <Pressable onPress={() => setShowDone((v) => !v)} style={styles.toggleBtn}>
          <Text style={styles.toggleText}>{showDone ? "Hide done" : "Show done"}</Text>
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 24 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your inbox is empty.</Text>
            <Text style={styles.emptyBody}>
              Tap + to capture anything on your mind. Drift will fold it into tomorrow&apos;s plan.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TaskRow task={item} onToggle={() => handleToggle(item)} onDelete={() => handleDelete(item)} />
        )}
      />

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
        testID="inbox-fab"
      >
        <Plus size={22} color={Colors.paper} strokeWidth={2.25} />
      </Pressable>
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
  return (
    <View style={styles.row}>
      <Pressable onPress={onToggle} style={styles.checkHit}>
        <View style={[styles.checkBox, task.is_complete && styles.checkBoxDone]}>
          {task.is_complete ? (
            <Check size={12} color={Colors.paper} strokeWidth={3} />
          ) : task.urgency_flag ? (
            <View style={styles.urgencyDot} />
          ) : null}
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.taskText,
            task.is_complete && styles.taskTextDone,
          ]}
        >
          {task.title}
        </Text>
        {task.urgency_flag && !task.is_complete && (
          <Text style={styles.urgent}>urgent</Text>
        )}
      </View>
      <Pressable onPress={onDelete} style={styles.delBtn} hitSlop={10}>
        <Trash2 size={16} color={Colors.inkFaint} strokeWidth={1.75} />
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
    letterSpacing: 2,
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
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  toggleText: {
    fontSize: 12,
    color: Colors.sageDeep,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 14,
  },
  checkHit: {
    padding: 4,
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
  checkBoxDone: {
    backgroundColor: Colors.sageDeep,
    borderColor: Colors.sageDeep,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.urgent,
  },
  taskText: {
    fontSize: 16,
    color: Colors.ink,
    lineHeight: 22,
    fontWeight: "500",
  },
  taskTextDone: {
    color: Colors.inkMuted,
    textDecorationLine: "line-through",
  },
  urgent: {
    marginTop: 2,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.urgent,
    fontWeight: "700",
  },
  delBtn: {
    padding: 6,
  },
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
    maxWidth: 280,
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
