import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { ArrowRight, BellRing, CalendarDays, Check, Send, Sparkles } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useProfile } from "@/providers/ProfileProvider";
import { listCalendars, requestCalendarPermission } from "@/lib/calendar";
import {
  formatTime,
  parseTime,
  requestNotificationPermission,
  scheduleMorningNotification,
} from "@/lib/notifications";
import {
  extractOnboardingFacts,
  summarizeOnboarding,
  type OnboardingSummary,
  type OnboardingTopic,
} from "@/lib/ai";
import type { UserProfile } from "@/types";

type Phase =
  | "welcome"
  | "chat"
  | "summary"
  | "perm-intro"
  | "notifications"
  | "time"
  | "calendar"
  | "calendar-pick"
  | "first-task"
  | "done";

type ChatMessage =
  | { id: string; from: "bot"; text: string }
  | { id: string; from: "user"; text: string };

const TOPIC_ORDER: OnboardingTopic[] = ["name", "household", "work", "anchors", "rules_energy"];

const TOPIC_PROMPTS: Record<OnboardingTopic, string> = {
  name: "Hi, I'm Drift. Before we start — what should I call you?",
  household: "Who's in your day-to-day life? A partner, kids, pets — whoever you plan around.",
  work: "What's work like right now? Remote, hybrid, office? Rough hours are fine.",
  anchors:
    "Any hard anchors — things you have to do most days at set times? School pickup, therapy, a standing meeting.",
  rules_energy:
    "Last thing: any personal rules I should know? Buffer times, energy patterns, non-negotiables.",
  open: "Anything else I should know?",
};

const TOPIC_CHIPS: Partial<Record<OnboardingTopic, string[]>> = {
  household: ["Just me", "Skip"],
  work: ["Remote", "Hybrid", "Office", "Flexible"],
  anchors: ["None", "Skip"],
  rules_energy: ["Skip"],
};

const TIMES = ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00"];

function uid(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { addTask } = useTasks();
  const { profile, merge, addHousehold, addAnchor, addRule } = useProfile();

  const [phase, setPhase] = useState<Phase>("welcome");
  const [topicIdx, setTopicIdx] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [thinking, setThinking] = useState<boolean>(false);
  const [summary, setSummary] = useState<OnboardingSummary | null>(null);
  const [revealed, setRevealed] = useState<number>(0);

  const [selectedTime, setSelectedTime] = useState<string>(settings.notification_time ?? "07:00");
  const [cals, setCals] = useState<CalendarT[]>([]);
  const [selectedCalIds, setSelectedCalIds] = useState<string[]>([]);
  const [firstTask, setFirstTask] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const scrollRef = useRef<ScrollView | null>(null);
  const fade = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [phase, fade]);

  const currentTopic: OnboardingTopic = TOPIC_ORDER[topicIdx] ?? "open";
  const currentChips = TOPIC_CHIPS[currentTopic];

  // Seed first bot message when entering chat
  useEffect(() => {
    if (phase === "chat" && messages.length === 0) {
      setMessages([{ id: uid(), from: "bot", text: TOPIC_PROMPTS.name }]);
    }
  }, [phase, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, thinking]);

  const goto = useCallback(
    (p: Phase) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      setPhase(p);
    },
    []
  );

  const applyExtract = useCallback(
    (extract: Awaited<ReturnType<typeof extractOnboardingFacts>>) => {
      if (extract.name && !profile.name) {
        merge({ name: extract.name });
      }
      for (const h of extract.household) {
        addHousehold({ kind: h.kind, name: h.name, detail: h.detail });
      }
      for (const a of extract.anchors) {
        addAnchor({
          title: a.title,
          time: a.time,
          days: a.days,
          buffer_minutes: a.buffer_minutes,
          notes: a.notes,
          location_id: null,
        });
      }
      if (extract.work) {
        merge({
          work: {
            mode: extract.work.mode,
            typical_hours: extract.work.typical_hours,
            notes: profile.work.notes,
          },
        });
      }
      for (const r of extract.rules) addRule(r);
      if (extract.energy_pattern) merge({ energy_pattern: extract.energy_pattern });
      if (extract.notes.length) {
        merge({ notes: [...profile.notes, ...extract.notes] });
      }
    },
    [profile, merge, addHousehold, addAnchor, addRule]
  );

  const advanceTopic = useCallback(
    (nextProfile: UserProfile) => {
      const nextIdx = topicIdx + 1;
      setTopicIdx(nextIdx);
      if (nextIdx >= TOPIC_ORDER.length) {
        // Move to summary
        setThinking(true);
        summarizeOnboarding(nextProfile)
          .then((s) => {
            setSummary(s);
            setRevealed(0);
            setPhase("summary");
          })
          .catch((e) => {
            console.log("[onboarding] summary error:", e);
            setPhase("perm-intro");
          })
          .finally(() => setThinking(false));
      } else {
        const nextTopic = TOPIC_ORDER[nextIdx];
        setMessages((prev) => [
          ...prev,
          { id: uid(), from: "bot", text: TOPIC_PROMPTS[nextTopic] },
        ]);
      }
    },
    [topicIdx]
  );

  const handleSendMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || thinking) return;
      if (Platform.OS !== "web") Haptics.selectionAsync();
      setDraft("");
      setMessages((prev) => [...prev, { id: uid(), from: "user", text }]);
      setThinking(true);

      const skip = /^(skip|none|no|nope|n\/a)\.?$/i.test(text);
      let nextProfile = profile;
      if (!skip) {
        try {
          const extract = await extractOnboardingFacts({
            topic: currentTopic,
            userMessage: text,
            currentProfile: profile,
          });
          applyExtract(extract);
          // Approximate next profile for summary use
          nextProfile = {
            ...profile,
            name: extract.name ?? profile.name,
            household: [
              ...profile.household,
              ...extract.household.map((h) => ({ ...h, id: `tmp_${Math.random()}` })),
            ],
            anchors: [
              ...profile.anchors,
              ...extract.anchors.map((a) => ({
                ...a,
                id: `tmp_${Math.random()}`,
                location_id: null,
              })),
            ],
            rules: [
              ...profile.rules,
              ...extract.rules.map((t) => ({ id: `tmp_${Math.random()}`, text: t })),
            ],
            work: extract.work
              ? {
                  mode: extract.work.mode,
                  typical_hours: extract.work.typical_hours,
                  notes: profile.work.notes,
                }
              : profile.work,
            energy_pattern: extract.energy_pattern ?? profile.energy_pattern,
            notes: [...profile.notes, ...extract.notes],
          };
        } catch (e) {
          console.log("[onboarding] extract error:", e);
        }
      }

      setThinking(false);
      advanceTopic(nextProfile);
    },
    [thinking, currentTopic, profile, applyExtract, advanceTopic]
  );

  // Summary bullet reveal
  useEffect(() => {
    if (phase !== "summary" || !summary) return;
    if (revealed >= summary.bullets.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), 320);
    return () => clearTimeout(t);
  }, [phase, summary, revealed]);

  const handleNotifYes = useCallback(async () => {
    setBusy(true);
    await requestNotificationPermission();
    setBusy(false);
    goto("time");
  }, [goto]);

  const handleCalendarYes = useCallback(async () => {
    setBusy(true);
    const granted = await requestCalendarPermission();
    if (granted) {
      const list = await listCalendars();
      setCals(list);
      setSelectedCalIds(list.map((c) => c.id));
      update({ calendar_enabled: true });
      setBusy(false);
      setPhase("calendar-pick");
    } else {
      update({ calendar_enabled: false, selected_calendar_ids: [] });
      setBusy(false);
      setPhase("first-task");
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
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase("done");
      setTimeout(() => router.replace("/"), 1600);
    } catch (e) {
      console.log("[onboarding] finish error:", e);
      setBusy(false);
    }
  }, [firstTask, busy, addTask, selectedTime, selectedCalIds, update, router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={{ flex: 1 }}
      >
        <Animated.View style={{ flex: 1, opacity: fade }}>
          {phase === "welcome" && <WelcomeStep onNext={() => goto("chat")} />}

          {phase === "chat" && (
            <ChatView
              messages={messages}
              thinking={thinking}
              draft={draft}
              onDraftChange={setDraft}
              onSend={handleSendMessage}
              chips={currentChips}
              scrollRef={scrollRef}
              bottomInset={insets.bottom}
              name={profile.name}
            />
          )}

          {phase === "summary" && summary && (
            <SummaryView
              summary={summary}
              revealed={revealed}
              allRevealed={revealed >= summary.bullets.length}
              onContinue={() => goto("perm-intro")}
              onRedo={() => {
                setMessages([]);
                setTopicIdx(0);
                setSummary(null);
                setRevealed(0);
                setPhase("chat");
              }}
            />
          )}

          {phase === "perm-intro" && (
            <PermIntroStep name={profile.name} onNext={() => goto("notifications")} />
          )}

          {phase === "notifications" && (
            <PermissionStep
              icon={<BellRing size={26} color={Colors.sageDeep} strokeWidth={1.5} />}
              title="Want me to nudge you each morning?"
              body="A quiet daily notification with your plan. You can change the time or turn it off any time."
              primary="Yes, nudge me"
              secondary="Not now"
              busy={busy}
              onPrimary={handleNotifYes}
              onSecondary={() => goto("time")}
            />
          )}

          {phase === "time" && (
            <TimeStep
              selectedTime={selectedTime}
              onSelect={setSelectedTime}
              onNext={() => goto("calendar")}
            />
          )}

          {phase === "calendar" && (
            <PermissionStep
              icon={<CalendarDays size={26} color={Colors.sageDeep} strokeWidth={1.5} />}
              title="Plan around your actual day."
              body="I read your calendar so your plan fits around meetings, not over them. Read-only, always."
              primary="Allow calendar access"
              secondary="Maybe later"
              busy={busy}
              onPrimary={handleCalendarYes}
              onSecondary={handleCalendarSkip}
            />
          )}

          {phase === "calendar-pick" && (
            <CalendarPickStep
              cals={cals}
              selectedIds={selectedCalIds}
              onToggle={toggleCal}
              onNext={() => goto("first-task")}
            />
          )}

          {phase === "first-task" && (
            <FirstTaskStep
              value={firstTask}
              onChange={setFirstTask}
              busy={busy}
              onFinish={handleFinish}
              name={profile.name}
            />
          )}

          {phase === "done" && (
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
        <Text style={styles.brand}>DRIFT</Text>
      </Animated.View>
      <Text style={styles.welcomeHeadline}>Your day, already figured out.</Text>
      <Text style={styles.welcomeSub}>
        Let&apos;s have a quick chat so I can plan around your life — not just your to-do list.
      </Text>
      <View style={{ flex: 1 }} />
      <PrimaryBtn label="Let's begin" onPress={onNext} />
    </View>
  );
}

function ChatView({
  messages,
  thinking,
  draft,
  onDraftChange,
  onSend,
  chips,
  scrollRef,
  bottomInset,
  name,
}: {
  messages: ChatMessage[];
  thinking: boolean;
  draft: string;
  onDraftChange: (s: string) => void;
  onSend: (s: string) => void;
  chips?: string[];
  scrollRef: React.MutableRefObject<ScrollView | null>;
  bottomInset: number;
  name: string | null;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.chatHeader}>
        <View style={styles.chatAvatar}>
          <View style={styles.chatAvatarLine} />
        </View>
        <View>
          <Text style={styles.chatHeaderName}>Drift</Text>
          <Text style={styles.chatHeaderSub}>
            {name ? `Nice to meet you, ${name}` : "getting to know you"}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.chatScroll}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {thinking && <TypingBubble />}
      </ScrollView>

      <View style={[styles.composerWrap, { paddingBottom: Math.max(bottomInset, 12) }]}>
        {chips && chips.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {chips.map((c) => (
              <Pressable key={c} style={styles.chip} onPress={() => onSend(c)}>
                <Text style={styles.chipText}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Type your answer…"
            placeholderTextColor={Colors.inkFaint}
            style={styles.composerInput}
            multiline
            editable={!thinking}
            testID="onboarding-chat-input"
          />
          <Pressable
            onPress={() => onSend(draft)}
            disabled={!draft.trim() || thinking}
            style={({ pressed }) => [
              styles.sendBtn,
              (!draft.trim() || thinking) && { opacity: 0.4 },
              pressed && { opacity: 0.7 },
            ]}
            testID="onboarding-chat-send"
          >
            <Send size={16} color={Colors.paper} strokeWidth={2.25} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const anim = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [anim]);
  const isBot = message.from === "bot";
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
        ],
        alignSelf: isBot ? "flex-start" : "flex-end",
        maxWidth: "84%",
        marginBottom: 8,
      }}
    >
      <View style={[styles.bubble, isBot ? styles.bubbleBot : styles.bubbleUser]}>
        <Text style={[styles.bubbleText, !isBot && styles.bubbleTextUser]}>{message.text}</Text>
      </View>
    </Animated.View>
  );
}

function TypingBubble() {
  const a1 = useMemo(() => new Animated.Value(0.3), []);
  const a2 = useMemo(() => new Animated.Value(0.3), []);
  const a3 = useMemo(() => new Animated.Value(0.3), []);
  useEffect(() => {
    const loop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 380, useNativeDriver: true }),
        ])
      ).start();
    loop(a1, 0);
    loop(a2, 140);
    loop(a3, 280);
  }, [a1, a2, a3]);
  return (
    <View style={[styles.bubble, styles.bubbleBot, { alignSelf: "flex-start", flexDirection: "row", gap: 4 }]}>
      <Animated.View style={[styles.typingDot, { opacity: a1 }]} />
      <Animated.View style={[styles.typingDot, { opacity: a2 }]} />
      <Animated.View style={[styles.typingDot, { opacity: a3 }]} />
    </View>
  );
}

function SummaryView({
  summary,
  revealed,
  allRevealed,
  onContinue,
  onRedo,
}: {
  summary: OnboardingSummary;
  revealed: number;
  allRevealed: boolean;
  onContinue: () => void;
  onRedo: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.iconCircle}>
        <Sparkles size={22} color={Colors.sageDeep} strokeWidth={1.5} />
      </View>
      <Text style={styles.h1}>{summary.opener}</Text>
      <View style={{ marginTop: 18, gap: 14 }}>
        {summary.bullets.map((b, i) => (
          <RevealBullet key={i} text={b} visible={i < revealed} />
        ))}
      </View>
      {allRevealed && (
        <>
          <Text style={[styles.p, { marginTop: 26 }]}>{summary.closer}</Text>
          <PrimaryBtn label="Yes, that's me" onPress={onContinue} />
          <Pressable onPress={onRedo} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>Not quite — let&apos;s try again</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function RevealBullet({ text, visible }: { text: string; visible: boolean }) {
  const anim = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (visible) {
      Animated.timing(anim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
    }
  }, [visible, anim]);
  if (!visible) return null;
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        ],
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <View style={styles.summaryDot} />
      <Text style={styles.summaryText}>{text}</Text>
    </Animated.View>
  );
}

function PermIntroStep({ name, onNext }: { name: string | null; onNext: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.h1}>
        {name ? `Thanks, ${name}.` : "Thanks."}
      </Text>
      <Text style={styles.p}>
        Two quick permissions so I can actually do this well. You can change either one later.
      </Text>
      <View style={{ height: 18 }} />
      <PrimaryBtn label="Continue" onPress={onNext} />
    </ScrollView>
  );
}

function PermissionStep({
  icon,
  title,
  body,
  primary,
  secondary,
  busy,
  onPrimary,
  onSecondary,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  primary: string;
  secondary: string;
  busy: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.iconCircle}>{icon}</View>
      <Text style={styles.h1}>{title}</Text>
      <Text style={styles.p}>{body}</Text>
      <View style={{ height: 18 }} />
      <PrimaryBtn label={busy ? "" : primary} onPress={onPrimary} loading={busy} />
      <Pressable onPress={onSecondary} style={styles.ghostBtn} disabled={busy}>
        <Text style={styles.ghostBtnText}>{secondary}</Text>
      </Pressable>
    </ScrollView>
  );
}

function TimeStep({
  selectedTime,
  onSelect,
  onNext,
}: {
  selectedTime: string;
  onSelect: (t: string) => void;
  onNext: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.h1}>When should your plan arrive?</Text>
      <Text style={styles.p}>You can change this any time in Settings.</Text>
      <View style={styles.timeGrid}>
        {TIMES.map((t) => {
          const on = t === selectedTime;
          return (
            <Pressable
              key={t}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                onSelect(t);
              }}
              style={[styles.timeChip, on && styles.timeChipOn]}
            >
              <Text style={[styles.timeChipText, on && styles.timeChipTextOn]}>
                {formatTime(t)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <PrimaryBtn label="Continue" onPress={onNext} />
    </ScrollView>
  );
}

function CalendarPickStep({
  cals,
  selectedIds,
  onToggle,
  onNext,
}: {
  cals: CalendarT[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.iconCircle}>
        <CalendarDays size={22} color={Colors.sageDeep} strokeWidth={1.5} />
      </View>
      <Text style={styles.h1}>Which calendars?</Text>
      <Text style={styles.p}>
        I&apos;ll only read from the ones you pick. Deselect anything personal you&apos;d rather
        keep out.
      </Text>
      <View style={styles.calList}>
        {cals.map((c) => {
          const on = selectedIds.includes(c.id);
          return (
            <Pressable key={c.id} onPress={() => onToggle(c.id)} style={styles.calRow}>
              <View style={[styles.calDot, { backgroundColor: c.color ?? Colors.sage }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.calName}>{c.title}</Text>
                {c.source?.name && <Text style={styles.calSource}>{c.source.name}</Text>}
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
      <PrimaryBtn label="Continue" onPress={onNext} />
    </ScrollView>
  );
}

function FirstTaskStep({
  value,
  onChange,
  busy,
  onFinish,
  name,
}: {
  value: string;
  onChange: (s: string) => void;
  busy: boolean;
  onFinish: () => void;
  name: string | null;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.iconCircle}>
        <Sparkles size={22} color={Colors.sageDeep} strokeWidth={1.5} />
      </View>
      <Text style={styles.h1}>
        {name ? `One more thing, ${name}.` : "One more thing."}
      </Text>
      <Text style={styles.p}>
        Give me something to hold. Anything on your mind — big or small.
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Finish the quarterly review by Friday"
        placeholderTextColor={Colors.inkFaint}
        style={styles.taskInput}
        multiline
        autoFocus
        testID="onboarding-first-task"
      />
      <PrimaryBtn
        label={busy ? "" : "I'm ready"}
        onPress={onFinish}
        loading={busy}
        disabled={!value.trim()}
      />
    </ScrollView>
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
  scroll: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 48 },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  h1: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -0.7,
    lineHeight: 34,
    marginBottom: 12,
  },
  p: { fontSize: 15, color: Colors.inkSoft, lineHeight: 22, marginBottom: 20 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  timeChipOn: { backgroundColor: Colors.sageDeep, borderColor: Colors.sageDeep },
  timeChipText: {
    fontSize: 14,
    color: Colors.inkSoft,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  timeChipTextOn: { color: Colors.paper, fontWeight: "600" },
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
  calDot: { width: 10, height: 10, borderRadius: 5 },
  calName: { fontSize: 15, color: Colors.ink, fontWeight: "500" },
  calSource: { fontSize: 11, color: Colors.inkMuted, marginTop: 2 },
  calCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.inkFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  calCheckOn: { backgroundColor: Colors.sageDeep, borderColor: Colors.sageDeep },
  mutedNote: { padding: 16, fontSize: 13, color: Colors.inkMuted, fontStyle: "italic" },
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
  ghostBtn: { alignItems: "center", paddingVertical: 14, marginTop: 6 },
  ghostBtnText: { color: Colors.inkSoft, fontSize: 14, fontWeight: "500" },
  welcomeWrap: { flex: 1, paddingHorizontal: 32, paddingTop: 80, paddingBottom: 40 },
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
    fontSize: 14,
    fontWeight: "700",
    color: Colors.sageDeep,
    letterSpacing: 2.5,
    marginBottom: 36,
  },
  welcomeHeadline: {
    fontSize: 36,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: 18,
  },
  welcomeSub: { fontSize: 16, color: Colors.inkSoft, lineHeight: 24 },
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
  chatHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarLine: {
    width: 18,
    height: 2,
    backgroundColor: Colors.sageDeep,
    borderRadius: 1,
    transform: [{ rotate: "-16deg" }],
  },
  chatHeaderName: { fontSize: 15, color: Colors.ink, fontWeight: "600" },
  chatHeaderSub: { fontSize: 11, color: Colors.inkMuted, letterSpacing: 0.4, marginTop: 2 },
  chatScroll: { paddingHorizontal: 16, paddingVertical: 16, gap: 2 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleBot: {
    backgroundColor: Colors.creamSoft,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: Colors.sageDeep,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 15, color: Colors.ink, lineHeight: 21 },
  bubbleTextUser: { color: Colors.paper },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.inkMuted,
  },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSoft,
    backgroundColor: Colors.background,
  },
  chipRow: { gap: 8, paddingHorizontal: 6, paddingBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontSize: 13, color: Colors.inkSoft, fontWeight: "500" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 6,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: Colors.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 15,
    color: Colors.ink,
    lineHeight: 21,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.sageDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.sageDeep,
    marginTop: 9,
  },
  summaryText: {
    flex: 1,
    fontSize: 16,
    color: Colors.ink,
    lineHeight: 23,
    fontWeight: "500",
  },
});
