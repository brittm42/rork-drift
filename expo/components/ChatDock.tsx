import * as Haptics from "expo-haptics";
import { Check, Send, Sparkles, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { Colors } from "@/constants/colors";
import { useChat } from "@/providers/ChatProvider";
import { useProfile } from "@/providers/ProfileProvider";
import type { ChatAction, ChatMessage } from "@/types";

type Props = {
  planHeader: string | null;
};

function greetingTime(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Late";
}

export function ChatDock({ planHeader }: Props) {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { todayMessages, send, confirmProposal, isThinking } = useChat();
  const [draft, setDraft] = useState<string>("");
  const [expanded, setExpanded] = useState<boolean>(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const hasMessages = todayMessages.length > 0;

  useEffect(() => {
    if (hasMessages) setExpanded(true);
  }, [hasMessages]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [todayMessages.length, isThinking]);

  const suggestion = useMemo(() => {
    if (planHeader) return planHeader;
    const first = profile.name ? profile.name.split(" ")[0] : null;
    return first
      ? `${greetingTime()}, ${first} — tell me what's on your mind.`
      : `${greetingTime()} — tell me what's on your mind.`;
  }, [planHeader, profile.name]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || isThinking) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setDraft("");
    setExpanded(true);
    send(text);
  }, [draft, isThinking, send]);

  const starters = useMemo(() => {
    const arr: string[] = [];
    arr.push("What's next?");
    if (planHeader) arr.push("Reshape my afternoon");
    arr.push("Add a task");
    return arr;
  }, [planHeader]);

  const handleStarter = useCallback(
    (s: string) => {
      if (s === "Add a task") {
        setExpanded(true);
        setDraft("");
        return;
      }
      if (Platform.OS !== "web") Haptics.selectionAsync();
      setExpanded(true);
      send(s);
    },
    [send]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom + 50 : 0}
      style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) + 58 }]}
      pointerEvents="box-none"
    >
      {expanded && hasMessages && (
        <View style={styles.transcriptWrap} pointerEvents="box-none">
          <View style={styles.transcriptCard}>
            <View style={styles.transcriptHead}>
              <View style={styles.avatar}>
                <View style={styles.avatarLine} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driftName}>Drift</Text>
                <Text style={styles.driftSub}>
                  {isThinking ? "thinking…" : "here when you need me"}
                </Text>
              </View>
              <Pressable
                onPress={() => setExpanded(false)}
                hitSlop={10}
                style={styles.closeBtn}
                testID="chat-collapse"
              >
                <X size={16} color={Colors.inkMuted} strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView
              ref={scrollRef}
              style={styles.transcript}
              contentContainerStyle={styles.transcriptInner}
              showsVerticalScrollIndicator={false}
            >
              {todayMessages.map((m) => (
                <TurnView
                  key={m.id}
                  message={m}
                  onConfirm={(ok) => confirmProposal(m.id, ok)}
                />
              ))}
              {isThinking && <ThinkingDots />}
            </ScrollView>
          </View>
        </View>
      )}

      {!hasMessages && !expanded && (
        <View style={styles.greetingWrap} pointerEvents="box-none">
          <Text style={styles.greetingText} numberOfLines={2}>
            {suggestion}
          </Text>
          <View style={styles.starterRow}>
            {starters.map((s) => (
              <Pressable
                key={s}
                onPress={() => handleStarter(s)}
                style={({ pressed }) => [styles.starter, pressed && { opacity: 0.7 }]}
                testID={`chat-starter-${s}`}
              >
                <Text style={styles.starterText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.composer}>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={styles.driftDot}
          hitSlop={8}
        >
          <Sparkles size={14} color={Colors.sageDeep} strokeWidth={2} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={
            hasMessages ? "Say anything…" : "Add, ask, reshape — I'm listening."
          }
          placeholderTextColor={Colors.inkFaint}
          style={styles.input}
          multiline
          onFocus={() => setExpanded(true)}
          editable={!isThinking}
          testID="chat-input"
        />
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim() || isThinking}
          style={({ pressed }) => [
            styles.sendBtn,
            (!draft.trim() || isThinking) && { opacity: 0.35 },
            pressed && { opacity: 0.7 },
          ]}
          testID="chat-send"
        >
          <Send size={15} color={Colors.paper} strokeWidth={2.25} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function TurnView({
  message,
  onConfirm,
}: {
  message: ChatMessage;
  onConfirm: (accept: boolean) => void;
}) {
  const anim = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [anim]);
  const isUser = message.from === "user";

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
        ],
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      {isUser ? (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      ) : (
        <View style={styles.botWrap}>
          <Text style={styles.botText}>{message.text}</Text>
          {message.actions && message.actions.length > 0 && (
            <View style={styles.chipCol}>
              {message.actions.map((a, idx) => (
                <ActionChip
                  key={`${a.kind}_${idx}`}
                  action={a}
                  pending={!!message.pending_confirm && a.kind === "propose_reshape"}
                  onConfirm={onConfirm}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function ActionChip({
  action,
  pending,
  onConfirm,
}: {
  action: ChatAction;
  pending: boolean;
  onConfirm: (accept: boolean) => void;
}) {
  if (action.kind === "answer") return null;
  if (action.kind === "propose_reshape") {
    return (
      <View style={styles.proposeCard}>
        <Text style={styles.proposeSummary}>{action.summary}</Text>
        <Text style={styles.proposeDetails}>{action.details}</Text>
        {pending ? (
          <View style={styles.proposeBtnRow}>
            <Pressable
              onPress={() => onConfirm(true)}
              style={({ pressed }) => [styles.proposeYes, pressed && { opacity: 0.8 }]}
              testID="chat-propose-yes"
            >
              <Text style={styles.proposeYesText}>Do it</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(false)}
              style={({ pressed }) => [styles.proposeNo, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.proposeNoText}>Not now</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.handledNote}>handled</Text>
        )}
      </View>
    );
  }
  if (action.kind === "do_reshape") {
    return (
      <View style={styles.savedChip}>
        <Sparkles size={11} color={Colors.sageDeep} strokeWidth={2} />
        <Text style={styles.savedText}>{action.summary}</Text>
      </View>
    );
  }
  const label =
    "confirmation" in action ? action.confirmation : String(action.kind);
  return (
    <View style={styles.savedChip}>
      <Check size={11} color={Colors.sageDeep} strokeWidth={2.5} />
      <Text style={styles.savedText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function ThinkingDots() {
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
    <View style={styles.thinkWrap}>
      <Animated.View style={[styles.thinkDot, { opacity: a1 }]} />
      <Animated.View style={[styles.thinkDot, { opacity: a2 }]} />
      <Animated.View style={[styles.thinkDot, { opacity: a3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  transcriptWrap: {
    paddingHorizontal: 12,
  },
  transcriptCard: {
    backgroundColor: Colors.paper,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    maxHeight: 360,
    overflow: "hidden",
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  transcriptHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLine: {
    width: 12,
    height: 2,
    backgroundColor: Colors.sageDeep,
    borderRadius: 1,
    transform: [{ rotate: "-16deg" }],
  },
  driftName: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  driftSub: { fontSize: 10, color: Colors.inkMuted, marginTop: 1, letterSpacing: 0.2 },
  closeBtn: { padding: 4 },
  transcript: { maxHeight: 300 },
  transcriptInner: { padding: 14 },
  userBubble: {
    backgroundColor: Colors.sageDeep,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    maxWidth: "82%",
  },
  userText: { color: Colors.paper, fontSize: 14, lineHeight: 20 },
  botWrap: { maxWidth: "92%", gap: 6 },
  botText: {
    fontSize: 15,
    color: Colors.ink,
    lineHeight: 22,
    paddingRight: 12,
  },
  chipCol: { gap: 6, marginTop: 4 },
  savedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: Colors.creamSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: "95%",
  },
  savedText: { fontSize: 12, color: Colors.sageDark, fontWeight: "600", flexShrink: 1 },
  proposeCard: {
    backgroundColor: Colors.creamSoft,
    padding: 12,
    borderRadius: 14,
    gap: 6,
  },
  proposeSummary: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  proposeDetails: { fontSize: 12, color: Colors.inkSoft, lineHeight: 17 },
  proposeBtnRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  proposeYes: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.sageDeep,
  },
  proposeYesText: { color: Colors.paper, fontSize: 12, fontWeight: "700" },
  proposeNo: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proposeNoText: { color: Colors.inkSoft, fontSize: 12, fontWeight: "600" },
  handledNote: {
    fontSize: 10,
    color: Colors.inkMuted,
    fontStyle: "italic",
    letterSpacing: 0.4,
  },
  thinkWrap: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  thinkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.inkMuted,
  },
  greetingWrap: {
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  greetingText: {
    fontSize: 13,
    color: Colors.inkSoft,
    lineHeight: 19,
    fontStyle: "italic",
    marginBottom: 10,
  },
  starterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  starter: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  starterText: { fontSize: 12, color: Colors.sageDeep, fontWeight: "600" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  driftDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: Colors.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.ink,
    lineHeight: 20,
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.sageDeep,
    alignItems: "center",
    justifyContent: "center",
  },
});
