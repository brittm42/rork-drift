import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { ArrowRight, Check, CalendarDays, Clock, Sparkles } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Calendar as CalendarT } from "expo-calendar";
import { Colors } from "@/constants/colors";
import { useSettings } from "@/providers/SettingsProvider";
import { useTasks } from "@/providers/TasksProvider";
import { listCalendars, requestCalendarPermission } from "@/lib/calendar";
import {
  formatTime,
  parseTime,
  requestNotificationPermission,
  scheduleMorningNotification,
} from "@/lib/notifications";

const TIMES = ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00"];

type Step = "welcome" | "time" | "calendar" | "calendar-pick" | "first-task" | "done";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { addTask } = useTasks();

  const [step, setStep] = useState<Step>("welcome");
  const [selectedTime, setSelectedTime] = useState<string>(settings.notification_time ?? "07:00");
  const [cals, setCals] = useState<CalendarT[]>([]);
  const [selectedCalIds, setSelectedCalIds] = useState<string[]>([]);
  const [firstTask, setFirstTask] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const fade = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [step, fade]);

  const goto = useCallback((s: Step) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setStep(s);
  }, []);

  const handlePickTime = useCallback((t: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedTime(t);
  }, []);

  const handleCalendarYes = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setBusy(true);
    const granted = await requestCalendarPermission();
    if (granted) {
      const list = await listCalendars();
      setCals(list);
      setSelectedCalIds(list.map((c) => c.id));
      update({ calendar_enabled: true });
      setBusy(false);
      setStep("calendar-pick");
    } else {
      update({ calendar_enabled: false, selected_calendar_ids: [] });
      setBusy(false);
      setStep("first-task");
    }
  }, [update]);

  const handleCalendarSkip = useCallback(() => {
    update({ calendar_enabled: false, selected_calendar_ids: [] });
    goto("first-task");
  }, [update, goto]);

  const toggleCal = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedCalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleFinish = useCallback(async () => {
    if (!firstTask.trim() || busy) return;
    setBusy(true);
    try {
      await addTask(firstTask.trim());
      await requestNotificationPermission();
      const { hour, minute } = parseTime(selectedTime);
      await scheduleMorningNotification({
        hour,
        minute,
        title: "Your day is planned",
        body: "Open Drift to see what's next.",
      });
      update({
        notification_time: selectedTime,
        selected_calendar_ids: selectedCalIds,
        onboarded: true,
      });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
      setTimeout(() => router.replace("/"), 1600);
    } catch (e) {
      console.log("[onboarding] finish error:", e);
      setBusy(false);
    }
  }, [firstTask, busy, addTask, selectedTime, selectedCalIds, update, router]);

  const stepNumber: Record<Step, number> = {
    welcome: 0,
    time: 1,
    calendar: 2,
    "calendar-pick": 2,
    "first-task": 3,
    done: 4,
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.progressRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= stepNumber[step] && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <Animated.View style={{ flex: 1, opacity: fade }}>
          {step === "welcome" && (
            <WelcomeStep onNext={() => goto("time")} />
          )}

          {step === "time" && (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.iconCircle}>
                <Clock size={26} color={Colors.sageDeep} strokeWidth={1.5} />
              </View>
              <Text style={styles.h1}>When should your day arrive?</Text>
              <Text style={styles.p}>
                Drift delivers your plan each morning at this time. You can change it any time.
              </Text>
              <View style={styles.timeGrid}>
                {TIMES.map((t) => {
                  const on = t === selectedTime;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => handlePickTime(t)}
                      style={[styles.timeChip, on && styles.timeChipOn]}
                    >
                      <Text style={[styles.timeChipText, on && styles.timeChipTextOn]}>
                        {formatTime(t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <PrimaryBtn label="Continue" onPress={() => goto("calendar")} />
            </ScrollView>
          )}

          {step === "calendar" && (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.iconCircle}>
                <CalendarDays size={26} color={Colors.sageDeep} strokeWidth={1.5} />
              </View>
              <Text style={styles.h1}>Plan around your actual day.</Text>
              <Text style={styles.p}>
                Drift reads your calendar so your plan fits around meetings — not over them.
                Read-only, always. Drift never writes to your calendar.
              </Text>
              <View style={{ height: 18 }} />
              <PrimaryBtn
                label={busy ? "" : "Allow calendar access"}
                onPress={handleCalendarYes}
                loading={busy}
              />
              <Pressable onPress={handleCalendarSkip} style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Maybe later</Text>
              </Pressable>
            </ScrollView>
          )}

          {step === "calendar-pick" && (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.iconCircle}>
                <CalendarDays size={26} color={Colors.sageDeep} strokeWidth={1.5} />
              </View>
              <Text style={styles.h1}>Which calendars?</Text>
              <Text style={styles.p}>
                Drift will only read from the ones you pick. Deselect anything personal you&apos;d
                rather keep out.
              </Text>
              <View style={styles.calList}>
                {cals.map((c) => {
                  const on = selectedCalIds.includes(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => toggleCal(c.id)}
                      style={styles.calRow}
                    >
                      <View style={[styles.calDot, { backgroundColor: c.color ?? Colors.sage }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.calName}>{c.title}</Text>
                        {c.source?.name && (
                          <Text style={styles.calSource}>{c.source.name}</Text>
                        )}
                      </View>
                      <View style={[styles.calCheck, on && styles.calCheckOn]}>
                        {on && <Check size={12} color={Colors.paper} strokeWidth={3} />}
                      </View>
                    </Pressable>
                  );
                })}
                {cals.length === 0 && (
                  <Text style={styles.mutedNote}>No calendars found on this device.</Text>
                )}
              </View>
              <PrimaryBtn label="Continue" onPress={() => goto("first-task")} />
            </ScrollView>
          )}

          {step === "first-task" && (
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.iconCircle}>
                <Sparkles size={24} color={Colors.sageDeep} strokeWidth={1.5} />
              </View>
              <Text style={styles.h1}>What&apos;s on your mind?</Text>
              <Text style={styles.p}>
                Add something Drift should hold for you. Anything — big or small.
              </Text>
              <TextInput
                value={firstTask}
                onChangeText={setFirstTask}
                placeholder="Finish the quarterly review by Friday"
                placeholderTextColor={Colors.inkFaint}
                style={styles.taskInput}
                multiline
                autoFocus
                testID="onboarding-first-task"
              />
              <PrimaryBtn
                label={busy ? "" : "I'm ready"}
                onPress={handleFinish}
                loading={busy}
                disabled={!firstTask.trim()}
              />
            </ScrollView>
          )}

          {step === "done" && (
            <View style={styles.doneWrap}>
              <View style={styles.doneCircle}>
                <Check size={32} color={Colors.paper} strokeWidth={2.5} />
              </View>
              <Text style={styles.h1}>You&apos;re set.</Text>
              <Text style={styles.p}>
                Your first plan will be ready at {formatTime(selectedTime)}.
              </Text>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const logoAnim = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(logoAnim, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [logoAnim]);

  return (
    <View style={styles.welcomeWrap}>
      <Animated.View
        style={{
          opacity: logoAnim,
          transform: [
            { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        }}
      >
        <View style={styles.brandMark}>
          <View style={styles.brandLine} />
        </View>
        <Text style={styles.brand}>Drift</Text>
      </Animated.View>
      <Text style={styles.welcomeHeadline}>Your day, already figured out.</Text>
      <Text style={styles.welcomeSub}>
        Drift reads your calendar, holds your tasks, and writes your plan each morning — around
        what&apos;s actually on your day, not over it.
      </Text>
      <View style={{ flex: 1 }} />
      <PrimaryBtn label="Let's begin" onPress={onNext} />
    </View>
  );
}

function PrimaryBtn({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        pressed && { opacity: 0.85 },
        (disabled || loading) && { opacity: 0.5 },
      ]}
      testID="onboarding-primary"
    >
      {loading ? (
        <ActivityIndicator color={Colors.paper} />
      ) : (
        <>
          <Text style={styles.primaryText}>{label}</Text>
          <ArrowRight size={18} color={Colors.paper} strokeWidth={2} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
  },
  progressDot: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.borderSoft,
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: Colors.sageDeep,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 48,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  h1: {
    fontSize: 30,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -0.8,
    lineHeight: 36,
    marginBottom: 12,
  },
  p: {
    fontSize: 15,
    color: Colors.inkSoft,
    lineHeight: 22,
    marginBottom: 28,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  timeChipOn: {
    backgroundColor: Colors.sageDeep,
    borderColor: Colors.sageDeep,
  },
  timeChipText: {
    fontSize: 14,
    color: Colors.inkSoft,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  timeChipTextOn: {
    color: Colors.paper,
    fontWeight: "600",
  },
  calList: {
    marginBottom: 28,
    backgroundColor: Colors.paper,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSoft,
  },
  calRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  calDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calName: {
    fontSize: 15,
    color: Colors.ink,
    fontWeight: "500",
  },
  calSource: {
    fontSize: 11,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  calCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  calCheckOn: {
    backgroundColor: Colors.sageDeep,
    borderColor: Colors.sageDeep,
  },
  mutedNote: {
    padding: 16,
    fontSize: 13,
    color: Colors.inkMuted,
    fontStyle: "italic",
  },
  taskInput: {
    fontSize: 22,
    color: Colors.ink,
    fontWeight: "500",
    lineHeight: 30,
    letterSpacing: -0.3,
    minHeight: 120,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginBottom: 24,
    textAlignVertical: "top",
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.sageDeep,
    paddingVertical: 16,
    borderRadius: 28,
  },
  primaryText: {
    color: Colors.paper,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  ghostBtn: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 6,
  },
  ghostBtnText: {
    color: Colors.inkSoft,
    fontSize: 14,
    fontWeight: "500",
  },
  welcomeWrap: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  brandLine: {
    width: 36,
    height: 2.5,
    backgroundColor: Colors.sageDeep,
    borderRadius: 2,
    transform: [{ rotate: "-16deg" }],
  },
  brand: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.sageDeep,
    letterSpacing: 2,
    marginBottom: 36,
  },
  welcomeHeadline: {
    fontSize: 38,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 18,
  },
  welcomeSub: {
    fontSize: 16,
    color: Colors.inkSoft,
    lineHeight: 24,
  },
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  doneCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.sageDeep,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
});
