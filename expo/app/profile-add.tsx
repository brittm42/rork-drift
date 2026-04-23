import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
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
import { Colors } from "@/constants/colors";
import { useProfile } from "@/providers/ProfileProvider";
import type { HouseholdMember, Weekday } from "@/types";

type AddType =
  | "name"
  | "work"
  | "energy"
  | "household"
  | "location"
  | "anchor"
  | "rule"
  | "obligation"
  | "duration"
  | "note";

const KIND_OPTIONS: HouseholdMember["kind"][] = ["partner", "child", "pet", "other"];
const WORK_MODES = ["remote", "hybrid", "office", "flexible"] as const;
const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];
const CADENCES = ["Weekly", "Biweekly", "Every 4 weeks", "Monthly", "Quarterly", "Yearly"];

const TITLES: Record<AddType, string> = {
  name: "Your name",
  work: "Work situation",
  energy: "Energy pattern",
  household: "Add someone",
  location: "Add a place",
  anchor: "Add an anchor",
  rule: "Add a rule",
  obligation: "Recurring item",
  duration: "Task duration",
  note: "Add a note",
};

const SUBTITLES: Record<AddType, string> = {
  name: "What should I call you?",
  work: "How do you usually work?",
  energy: "When do you feel sharpest?",
  household: "Partner, kid, pet, or other.",
  location: "Places you go often.",
  anchor: "Something you do at a fixed time.",
  rule: "One line. I'll honor it when planning.",
  obligation: "Grooming, vet, refills — things that recur.",
  duration: "How long a kind of task usually takes you.",
  note: "Anything else I should keep in mind.",
};

export default function ProfileAddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const type = (params.type as AddType) ?? "note";
  const {
    profile,
    merge,
    addHousehold,
    addLocation,
    addAnchor,
    addRule,
    addObligation,
    addDuration,
    addNote,
  } = useProfile();

  // Shared state (only some are used per type)
  const [text, setText] = useState<string>("");
  const [sub, setSub] = useState<string>("");
  const [kind, setKind] = useState<HouseholdMember["kind"]>("child");
  const [workMode, setWorkMode] = useState<(typeof WORK_MODES)[number] | null>(
    profile.work.mode === "unspecified" ? null : (profile.work.mode as (typeof WORK_MODES)[number])
  );
  const [workHours, setWorkHours] = useState<string>(profile.work.typical_hours ?? "");
  const [time, setTime] = useState<string>("");
  const [buffer, setBuffer] = useState<string>("");
  const [days, setDays] = useState<Weekday[]>([]);
  const [cadence, setCadence] = useState<string>(CADENCES[2]);
  const [minutes, setMinutes] = useState<string>("");

  const toggleDay = useCallback((d: Weekday) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }, []);

  const canSave = useMemo(() => {
    switch (type) {
      case "name":
      case "energy":
      case "rule":
      case "note":
        return text.trim().length > 0;
      case "work":
        return workMode !== null;
      case "household":
        return text.trim().length > 0;
      case "location":
        return text.trim().length > 0;
      case "anchor":
        return text.trim().length > 0 && days.length > 0;
      case "obligation":
        return text.trim().length > 0;
      case "duration":
        return text.trim().length > 0 && /^\d+$/.test(minutes) && parseInt(minutes, 10) > 0;
      default:
        return false;
    }
  }, [type, text, workMode, days, minutes]);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    switch (type) {
      case "name":
        merge({ name: text.trim() });
        break;
      case "work":
        merge({
          work: {
            mode: (workMode ?? "unspecified") as never,
            typical_hours: workHours.trim() || null,
            notes: profile.work.notes,
          },
        });
        break;
      case "energy":
        merge({ energy_pattern: text.trim() });
        break;
      case "household":
        addHousehold({ name: text.trim(), kind, detail: sub.trim() || null });
        break;
      case "location":
        addLocation({ label: text.trim(), address: sub.trim() || null, notes: null });
        break;
      case "anchor":
        addAnchor({
          title: text.trim(),
          time: time.trim() || null,
          days,
          buffer_minutes: /^\d+$/.test(buffer) ? parseInt(buffer, 10) : null,
          location_id: null,
          notes: null,
        });
        break;
      case "rule":
        addRule(text.trim());
        break;
      case "obligation":
        addObligation({
          title: text.trim(),
          cadence,
          last_done_at: null,
          notes: null,
        });
        break;
      case "duration":
        addDuration({ task_pattern: text.trim(), minutes: parseInt(minutes, 10) });
        break;
      case "note":
        addNote(text.trim());
        break;
    }
    router.back();
  }, [
    canSave,
    type,
    text,
    sub,
    kind,
    workMode,
    workHours,
    time,
    buffer,
    days,
    cadence,
    minutes,
    profile.work.notes,
    merge,
    addHousehold,
    addLocation,
    addAnchor,
    addRule,
    addObligation,
    addDuration,
    addNote,
    router,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <X size={22} color={Colors.inkSoft} strokeWidth={1.75} />
          </Pressable>
          <Text style={styles.headerTitle}>{TITLES[type]}</Text>
          <Pressable onPress={handleSave} disabled={!canSave} hitSlop={12} testID="profile-add-save">
            <Text style={[styles.save, !canSave && { color: Colors.inkFaint }]}>Save</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sub}>{SUBTITLES[type]}</Text>

          {(type === "name" || type === "energy" || type === "rule" || type === "note") && (
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                type === "name"
                  ? "Britt"
                  : type === "energy"
                    ? "Sharp mornings, afternoon dip"
                    : type === "rule"
                      ? "25 min buffer home to school pickup"
                      : "Anything I should know"
              }
              placeholderTextColor={Colors.inkFaint}
              style={styles.bigInput}
              multiline={type === "rule" || type === "note"}
              autoFocus
            />
          )}

          {type === "work" && (
            <>
              <Label text="Mode" />
              <View style={styles.chipRow}>
                {WORK_MODES.map((m) => {
                  const on = workMode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        setWorkMode(m);
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {m[0].toUpperCase() + m.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Label text="Typical hours (optional)" />
              <TextInput
                value={workHours}
                onChangeText={setWorkHours}
                placeholder="9–5, or flexible"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
              />
            </>
          )}

          {type === "household" && (
            <>
              <Label text="Name" />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Alex"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
                autoFocus
              />
              <Label text="Who?" />
              <View style={styles.chipRow}>
                {KIND_OPTIONS.map((k) => {
                  const on = kind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        setKind(k);
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {k[0].toUpperCase() + k.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Label text="Detail (optional)" />
              <TextInput
                value={sub}
                onChangeText={setSub}
                placeholder="Age, school, schedule, breed…"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
              />
            </>
          )}

          {type === "location" && (
            <>
              <Label text="Label" />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Home, Office, School, Gym"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
                autoFocus
              />
              <Label text="Address or note (optional)" />
              <TextInput
                value={sub}
                onChangeText={setSub}
                placeholder="123 Main St, or 'across town'"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
              />
            </>
          )}

          {type === "anchor" && (
            <>
              <Label text="Title" />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="School pickup"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
                autoFocus
              />
              <Label text="Time" />
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="15:30"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
                keyboardType="numbers-and-punctuation"
              />
              <Label text="Days" />
              <View style={styles.chipRow}>
                {WEEKDAYS.map((d) => {
                  const on = days.includes(d.key);
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => toggleDay(d.key)}
                      style={[styles.dayChip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{d.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Label text="Buffer minutes (optional)" />
              <TextInput
                value={buffer}
                onChangeText={setBuffer}
                placeholder="25"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
                keyboardType="number-pad"
              />
            </>
          )}

          {type === "obligation" && (
            <>
              <Label text="Title" />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Dog grooming"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
                autoFocus
              />
              <Label text="Cadence" />
              <View style={styles.chipRow}>
                {CADENCES.map((c) => {
                  const on = cadence === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        setCadence(c);
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {type === "duration" && (
            <>
              <Label text="What kind of task?" />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Dishes"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
                autoFocus
              />
              <Label text="Minutes" />
              <TextInput
                value={minutes}
                onChangeText={setMinutes}
                placeholder="10"
                placeholderTextColor={Colors.inkFaint}
                style={styles.input}
                keyboardType="number-pad"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 60,
  },
  sub: {
    fontSize: 14,
    color: Colors.inkSoft,
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.inkMuted,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 18,
  },
  input: {
    fontSize: 16,
    color: Colors.ink,
    backgroundColor: Colors.paper,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bigInput: {
    fontSize: 22,
    color: Colors.ink,
    fontWeight: "500",
    lineHeight: 30,
    letterSpacing: -0.3,
    minHeight: 80,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginTop: 6,
    textAlignVertical: "top",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  chipOn: { backgroundColor: Colors.sageDeep, borderColor: Colors.sageDeep },
  chipText: { fontSize: 13, color: Colors.inkSoft, fontWeight: "500" },
  chipTextOn: { color: Colors.paper, fontWeight: "600" },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
});
