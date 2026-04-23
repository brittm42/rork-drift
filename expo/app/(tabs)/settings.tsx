import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, ChevronRight, Eraser, Map as MapIcon, User } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useSettings } from "@/providers/SettingsProvider";
import { useChat } from "@/providers/ChatProvider";
import {
  findWritableCalendarId,
  getCalendarPermissionStatus,
  listCalendars,
  requestCalendarPermission,
} from "@/lib/calendar";
import { parseTime, scheduleMorningNotification } from "@/lib/notifications";
import { formatHHMM } from "@/lib/time";
import type { Calendar as CalendarT } from "expo-calendar";
import type { TimeFormat } from "@/types";

const TIME_CHOICES = [
  "05:30",
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { clear: clearChat, todayMessages, messages } = useChat();
  const [timeOpen, setTimeOpen] = useState<boolean>(false);
  const [tokenDraft, setTokenDraft] = useState<string>(settings.mapkit_token ?? "");
  const [tokenEditing, setTokenEditing] = useState<boolean>(false);
  const [cals, setCals] = useState<CalendarT[]>([]);
  const [permStatus, setPermStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");

  const loadCals = useCallback(async () => {
    const status = await getCalendarPermissionStatus();
    setPermStatus(status);
    if (status === "granted") {
      const list = await listCalendars();
      setCals(list);
    } else {
      setCals([]);
    }
  }, []);

  useEffect(() => {
    loadCals();
  }, [loadCals]);

  const handleTimeChange = useCallback(
    async (t: string) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      update({ notification_time: t });
      setTimeOpen(false);
      const { hour, minute } = parseTime(t);
      await scheduleMorningNotification({
        hour,
        minute,
        title: "Your day is planned",
        body: "Open Drift to see what's next.",
      });
    },
    [update]
  );

  const handleCalendarToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        update({ calendar_enabled: false, calendar_write_enabled: false });
        return;
      }
      const granted = await requestCalendarPermission();
      if (!granted) {
        Alert.alert(
          "Calendar access needed",
          "Enable calendar access in Settings so Drift can plan around your day."
        );
        return;
      }
      const list = await listCalendars();
      setCals(list);
      setPermStatus("granted");
      update({
        calendar_enabled: true,
        selected_calendar_ids:
          settings.selected_calendar_ids.length > 0
            ? settings.selected_calendar_ids
            : list.map((c) => c.id),
      });
    },
    [settings.selected_calendar_ids, update]
  );

  const handleCalWriteToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        update({ calendar_write_enabled: false });
        return;
      }
      if (!settings.calendar_enabled) {
        await handleCalendarToggle(true);
      }
      const granted = await requestCalendarPermission();
      if (!granted) {
        Alert.alert(
          "Calendar access needed",
          "Enable calendar access first so Drift can add events."
        );
        return;
      }
      const writableId = await findWritableCalendarId(settings.default_write_calendar_id);
      update({ calendar_write_enabled: true, default_write_calendar_id: writableId });
    },
    [
      settings.calendar_enabled,
      settings.default_write_calendar_id,
      update,
      handleCalendarToggle,
    ]
  );

  const toggleCalendar = useCallback(
    (id: string) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      const set = new Set(settings.selected_calendar_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      update({ selected_calendar_ids: Array.from(set) });
    },
    [settings.selected_calendar_ids, update]
  );

  const calendarsByAccount = useMemo(() => {
    const groups = new Map<string, CalendarT[]>();
    for (const c of cals) {
      const key = c.source?.name ?? "Calendars";
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [cals]);

  const writableCals = useMemo(() => cals.filter((c) => c.allowsModifications), [cals]);

  const handleClearChat = useCallback(() => {
    const go = () => {
      clearChat();
      update({ chat_last_cleared_at: new Date().toISOString() });
    };
    if (Platform.OS === "web") {
      go();
      return;
    }
    Alert.alert(
      "Clear chat history?",
      "This removes our recent conversation. What I remember about you stays in your profile.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: go },
      ]
    );
  }, [clearChat, update]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 14,
        paddingBottom: 140,
        paddingHorizontal: 24,
      }}
    >
      <Text style={styles.eyebrow}>SETTINGS</Text>
      <Text style={styles.pageTitle}>Drift</Text>

      <Section title="What I know about you">
        <Pressable
          onPress={() => router.push("/profile")}
          style={styles.profileRow}
          testID="settings-profile-link"
        >
          <View style={styles.profileIcon}>
            <User size={16} color={Colors.sageDeep} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Your profile</Text>
            <Text style={styles.rowSub}>
              Household, anchors, rules, memories, recurring items
            </Text>
          </View>
          <ChevronRight size={16} color={Colors.inkFaint} strokeWidth={2} />
        </Pressable>
      </Section>

      <Section title="Display">
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowLabel}>Time format</Text>
            <Text style={styles.rowSub}>Used everywhere in the app.</Text>
          </View>
          <View style={styles.segment}>
            {(["12h", "24h"] as TimeFormat[]).map((f) => {
              const on = settings.time_format === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    update({ time_format: f });
                  }}
                  style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                  testID={`time-format-${f}`}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                    {f === "12h" ? "12-hour" : "24-hour"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Section>

      <Section title="Morning plan">
        <Row
          label="Delivery time"
          value={formatHHMM(settings.notification_time, settings.time_format)}
          onPress={() => setTimeOpen((v) => !v)}
          chevron
        />
        {timeOpen && (
          <View style={styles.timeGrid}>
            {TIME_CHOICES.map((t) => {
              const selected = t === settings.notification_time;
              return (
                <Pressable
                  key={t}
                  onPress={() => handleTimeChange(t)}
                  style={[styles.timeChip, selected && styles.timeChipSelected]}
                >
                  <Text style={[styles.timeChipText, selected && styles.timeChipTextSelected]}>
                    {formatHHMM(t, settings.time_format)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <RowToggle
          label="Anchor to my calendar"
          sub="Shift earlier if my first meeting is early"
          value={settings.notification_mode === "anchored"}
          onChange={(v) => update({ notification_mode: v ? "anchored" : "fixed" })}
        />
        <RowToggle
          label="Adaptive content"
          sub="Packed days read differently than open ones"
          value={settings.adaptive_content}
          onChange={(v) => update({ adaptive_content: v })}
        />
        <RowToggle
          label="Mid-day nudges"
          sub="Gentle pre-meeting and next-task reminders"
          value={settings.midday_nudges}
          onChange={(v) => update({ midday_nudges: v })}
        />
      </Section>

      <Section title="Calendar">
        <RowToggle
          label="Read my calendar"
          sub="Drift plans around your day."
          value={settings.calendar_enabled}
          onChange={handleCalendarToggle}
        />
        <RowToggle
          label="Let Drift add events"
          sub="Gym blocks, appointments, time you ask to protect."
          value={settings.calendar_write_enabled}
          onChange={handleCalWriteToggle}
        />
        {settings.calendar_write_enabled && writableCals.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <Text style={styles.subhead}>WRITE EVENTS TO</Text>
            {writableCals.map((c) => {
              const selected =
                settings.default_write_calendar_id === c.id ||
                (!settings.default_write_calendar_id && writableCals[0].id === c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() =>
                    update({ default_write_calendar_id: c.id })
                  }
                  style={styles.calRow}
                >
                  <View
                    style={[styles.calDot, { backgroundColor: c.color ?? Colors.sage }]}
                  />
                  <Text style={styles.calName} numberOfLines={1}>
                    {c.title}
                  </Text>
                  <View style={[styles.calCheck, selected && styles.calCheckSelected]}>
                    {selected && <Check size={12} color={Colors.paper} strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {settings.calendar_enabled && permStatus === "granted" && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.subhead}>READ FROM</Text>
            {calendarsByAccount.length === 0 ? (
              <Text style={styles.muted}>No calendars found.</Text>
            ) : (
              calendarsByAccount.map(([account, list]) => (
                <View key={account} style={{ marginBottom: 12 }}>
                  <Text style={styles.accountLabel}>{account}</Text>
                  {list.map((c) => {
                    const selected = settings.selected_calendar_ids.includes(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => toggleCalendar(c.id)}
                        style={styles.calRow}
                      >
                        <View
                          style={[
                            styles.calDot,
                            { backgroundColor: c.color ?? Colors.sage },
                          ]}
                        />
                        <Text style={styles.calName} numberOfLines={1}>
                          {c.title}
                        </Text>
                        <View style={[styles.calCheck, selected && styles.calCheckSelected]}>
                          {selected && <Check size={12} color={Colors.paper} strokeWidth={3} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        )}
        {Platform.OS === "web" && (
          <Text style={styles.muted}>Calendar access is available on iOS.</Text>
        )}
      </Section>

      <Section title="Apple Maps">
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowLabel}>MapKit JS token</Text>
            <Text style={styles.rowSub}>
              {settings.mapkit_token
                ? "Connected — location search and drive time are unlocked."
                : "Paste a MapKit JS auth token (JWT) from developer.apple.com to enable place search."}
            </Text>
          </View>
          <MapIcon
            size={16}
            color={settings.mapkit_token ? Colors.sageDeep : Colors.inkFaint}
            strokeWidth={2}
          />
        </View>
        {tokenEditing ? (
          <View style={styles.tokenBox}>
            <TextInput
              value={tokenDraft}
              onChangeText={setTokenDraft}
              placeholder="eyJhbGciOi…"
              placeholderTextColor={Colors.inkFaint}
              style={styles.tokenInput}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              testID="mapkit-token-input"
            />
            <View style={styles.tokenBtnRow}>
              <Pressable
                onPress={() => {
                  setTokenDraft(settings.mapkit_token ?? "");
                  setTokenEditing(false);
                }}
                style={styles.tokenBtnGhost}
              >
                <Text style={styles.tokenBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const trimmed = tokenDraft.trim();
                  update({ mapkit_token: trimmed.length > 0 ? trimmed : null });
                  setTokenEditing(false);
                }}
                style={styles.tokenBtnPrimary}
              >
                <Text style={styles.tokenBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setTokenDraft(settings.mapkit_token ?? "");
              setTokenEditing(true);
            }}
            style={styles.row}
            testID="mapkit-token-edit"
          >
            <Text style={[styles.rowLabel, { color: Colors.sageDeep }]}>
              {settings.mapkit_token ? "Replace token" : "Paste token"}
            </Text>
            <ChevronRight size={14} color={Colors.inkFaint} strokeWidth={2} />
          </Pressable>
        )}
        {settings.mapkit_token && !tokenEditing && (
          <Pressable
            onPress={() => {
              update({ mapkit_token: null });
              setTokenDraft("");
            }}
            style={styles.row}
          >
            <Text style={[styles.rowLabel, { color: Colors.urgent }]}>Disconnect</Text>
          </Pressable>
        )}
      </Section>

      <Section title="Chat">
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowLabel}>Chat history</Text>
            <Text style={styles.rowSub}>
              Last 7 days kept automatically · {messages.length} messages ({todayMessages.length} today)
            </Text>
          </View>
        </View>
        <Pressable onPress={handleClearChat} style={styles.row} testID="clear-chat-btn">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Eraser size={14} color={Colors.urgent} strokeWidth={2} />
            <Text style={[styles.rowLabel, { color: Colors.urgent }]}>
              Clear chat history
            </Text>
          </View>
        </Pressable>
      </Section>

      <Section title="About">
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Drift</Text>
          <Text style={styles.aboutBody}>
            Your day, already figured out. Built for the way you actually work — around what&apos;s
            on your calendar, not over it.
          </Text>
          <Text style={styles.version}>v1.0</Text>
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  chevron,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  chevron?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={styles.rowValue}>{value}</Text>
        {chevron && <ChevronDown size={14} color={Colors.inkMuted} strokeWidth={2} />}
      </View>
    </Pressable>
  );
}

function RowToggle({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.borderSoft, true: Colors.sage }}
        thumbColor={Platform.OS === "android" ? (value ? Colors.sageDeep : Colors.paper) : undefined}
        ios_backgroundColor={Colors.borderSoft}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.inkMuted,
    fontWeight: "600",
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -0.8,
    marginBottom: 28,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: Colors.inkMuted,
    fontWeight: "700",
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionBody: {
    backgroundColor: Colors.paper,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSoft,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.ink,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.sageDeep,
    fontWeight: "600",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeChipSelected: {
    backgroundColor: Colors.sageDeep,
    borderColor: Colors.sageDeep,
  },
  timeChipText: {
    fontSize: 13,
    color: Colors.inkSoft,
    fontVariant: ["tabular-nums"],
  },
  timeChipTextSelected: {
    color: Colors.paper,
    fontWeight: "600",
  },
  subhead: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.inkMuted,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  accountLabel: {
    fontSize: 11,
    color: Colors.inkMuted,
    paddingHorizontal: 16,
    paddingBottom: 4,
    letterSpacing: 0.4,
    fontWeight: "600",
  },
  calRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  calDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  calName: {
    flex: 1,
    fontSize: 14,
    color: Colors.ink,
  },
  calCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  calCheckSelected: {
    backgroundColor: Colors.sageDeep,
    borderColor: Colors.sageDeep,
  },
  muted: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    color: Colors.inkMuted,
    fontStyle: "italic",
  },
  aboutCard: {
    padding: 16,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: Colors.creamSoft,
    borderRadius: 14,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 11,
  },
  segmentBtnOn: {
    backgroundColor: Colors.sageDeep,
  },
  segmentText: {
    fontSize: 12,
    color: Colors.inkSoft,
    fontWeight: "600",
  },
  segmentTextOn: {
    color: Colors.paper,
  },
  tokenBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  tokenInput: {
    minHeight: 80,
    maxHeight: 180,
    fontSize: 12,
    color: Colors.ink,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlignVertical: "top",
  },
  tokenBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  tokenBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tokenBtnGhostText: {
    fontSize: 13,
    color: Colors.inkSoft,
    fontWeight: "600",
  },
  tokenBtnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Colors.sageDeep,
  },
  tokenBtnPrimaryText: {
    fontSize: 13,
    color: Colors.paper,
    fontWeight: "700",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 6,
  },
  aboutBody: {
    fontSize: 13,
    color: Colors.inkSoft,
    lineHeight: 19,
  },
  version: {
    fontSize: 11,
    color: Colors.inkMuted,
    marginTop: 10,
    letterSpacing: 0.5,
  },
});
