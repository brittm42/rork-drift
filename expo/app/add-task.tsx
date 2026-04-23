import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useTasks } from "@/providers/TasksProvider";

export default function AddTaskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addTask } = useTasks();
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await addTask(trimmed);
    } catch (e) {
      console.log("[add-task] save error:", e);
    } finally {
      setBusy(false);
      router.back();
    }
  }, [text, busy, addTask, router]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <X size={22} color={Colors.inkSoft} strokeWidth={1.75} />
          </Pressable>
          <Text style={styles.headerTitle}>New task</Text>
          <Pressable
            onPress={handleSave}
            disabled={!text.trim() || busy}
            hitSlop={12}
          >
            {busy ? (
              <ActivityIndicator color={Colors.sageDeep} />
            ) : (
              <Text
                style={[
                  styles.save,
                  !text.trim() && { color: Colors.inkFaint },
                ]}
              >
                Add
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.prompt}>What&apos;s on your mind?</Text>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Type anything. Drift figures out the rest."
            placeholderTextColor={Colors.inkFaint}
            style={styles.input}
            multiline
            autoCorrect
            onSubmitEditing={handleSave}
            returnKeyType="done"
            blurOnSubmit
            testID="add-task-input"
          />
          <Text style={styles.hint}>
            Words like &quot;today&quot;, &quot;ASAP&quot;, or &quot;by Friday&quot; get noticed.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.ink,
    letterSpacing: 0.2,
  },
  save: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.sageDeep,
    letterSpacing: 0.2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  prompt: {
    fontSize: 13,
    letterSpacing: 1.4,
    color: Colors.inkMuted,
    fontWeight: "600",
    marginBottom: 14,
    textTransform: "uppercase",
  },
  input: {
    fontSize: 24,
    color: Colors.ink,
    fontWeight: "500",
    lineHeight: 32,
    letterSpacing: -0.3,
    minHeight: 140,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 18,
    fontStyle: "italic",
  },
});
