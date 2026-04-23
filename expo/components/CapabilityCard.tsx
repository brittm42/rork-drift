import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronDown, ChevronRight, Plus, Sparkles } from "lucide-react-native";
import React, { useCallback, useMemo, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { useProfile } from "@/providers/ProfileProvider";
import { useSettings } from "@/providers/SettingsProvider";

type Suggestion = {
  id: string;
  type: string;
  title: string;
  sub: string;
};

const MAX_VISIBLE = 3;

function pickStable<T>(list: T[], n: number, seed: number): T[] {
  if (list.length <= n) return list;
  const out: T[] = [];
  const used = new Set<number>();
  let s = seed || 1;
  while (out.length < n && used.size < list.length) {
    s = (s * 9301 + 49297) % 233280;
    const idx = Math.floor((s / 233280) * list.length);
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(list[idx]);
  }
  return out;
}

export function CapabilityCard() {
  const router = useRouter();
  const { profile } = useProfile();
  const { settings } = useSettings();
  const [expanded, setExpanded] = React.useState<boolean>(false);
  const seedRef = useRef<number>(Math.floor(Math.random() * 1_000_000));

  const suggestions = useMemo<Suggestion[]>(() => {
    const list: Suggestion[] = [];
    if (profile.locations.length < 3) {
      list.push({
        id: "locations",
        type: "location",
        title: "Add a place you go often",
        sub: "Home, work, school, gym — unlocks travel time in your plan.",
      });
    }
    if (profile.anchors.length < 2) {
      list.push({
        id: "anchors",
        type: "anchor",
        title: "Add a daily anchor",
        sub: "School pickup, standing meeting — I'll plan around it.",
      });
    }
    if (profile.recurring_obligations.length < 2) {
      list.push({
        id: "obligations",
        type: "obligation",
        title: "Add something that repeats",
        sub: "Grooming, vet, refills — I'll surface these on time.",
      });
    }
    if (profile.rules.length < 3) {
      list.push({
        id: "rules",
        type: "rule",
        title: "Share a tendency",
        sub: `"No meetings after 4pm." "25 min buffer to school."`,
      });
    }
    if (profile.household.length === 0) {
      list.push({
        id: "household",
        type: "household",
        title: "Tell me who you plan around",
        sub: "Partner, kids, pets — makes the plan feel like yours.",
      });
    } else if (profile.household.some((h) => !h.birthday)) {
      list.push({
        id: "household-bdays",
        type: "household",
        title: "Add household birthdays",
        sub: "I'll nudge you a couple weeks ahead so nothing slips.",
      });
    }
    if (!profile.energy_pattern) {
      list.push({
        id: "energy",
        type: "energy",
        title: "Share your energy pattern",
        sub: "Sharp mornings? Afternoon dip? I'll order the day around it.",
      });
    }
    if (profile.task_durations.length < 2) {
      list.push({
        id: "durations",
        type: "duration",
        title: "How long do your tasks take?",
        sub: `"Dishes: 10 min." I'll size time blocks to match.`,
      });
    }
    if (profile.work.mode === "unspecified") {
      list.push({
        id: "work",
        type: "work",
        title: "Tell me what fills your days",
        sub: "Work, school, caregiving — shapes when I plan what.",
      });
    }
    if (settings.calendar_enabled && !settings.calendar_write_enabled) {
      list.push({
        id: "cal-write",
        type: "calendar-write",
        title: "Let me put blocks on your calendar",
        sub: "When you ask for gym time, it actually shows up there.",
      });
    }
    if (!settings.mapkit_token) {
      list.push({
        id: "mapkit",
        type: "mapkit-setup",
        title: "Connect Apple Maps",
        sub: "So I can search real places and time your departures.",
      });
    }
    return list;
  }, [profile, settings.calendar_enabled, settings.calendar_write_enabled, settings.mapkit_token]);

  const visible = useMemo(
    () => pickStable(suggestions, MAX_VISIBLE, seedRef.current),
    [suggestions]
  );

  const handleAdd = useCallback(
    (type: string) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      if (type === "calendar-write" || type === "mapkit-setup") {
        router.push("/(tabs)/settings");
        return;
      }
      router.push({ pathname: "/profile-add", params: { type } });
    },
    [router]
  );

  if (suggestions.length === 0) {
    return (
      <Pressable
        onPress={() => router.push("/profile")}
        style={({ pressed }) => [styles.fullPill, pressed && { opacity: 0.8 }]}
        testID="capability-card"
      >
        <Sparkles size={13} color={Colors.sageDeep} strokeWidth={2} />
        <Text style={styles.fullText}>Full context · tap to review</Text>
        <ChevronRight size={13} color={Colors.inkMuted} strokeWidth={2} />
      </Pressable>
    );
  }

  const toggle = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setExpanded((v) => !v);
  }, []);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.header,
          expanded && styles.headerExpanded,
          pressed && { opacity: 0.85 },
        ]}
        testID="capability-card"
      >
        <View style={styles.headerIcon}>
          <Sparkles size={13} color={Colors.sageDeep} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>DO MORE TOGETHER</Text>
          <Text style={styles.headerText}>Tell me more about you</Text>
        </View>
        <ChevronDown
          size={16}
          color={Colors.inkMuted}
          strokeWidth={2}
          style={expanded ? styles.chevronOpen : undefined}
        />
      </Pressable>

      {expanded && (
        <View style={styles.listCard}>
          {visible.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => handleAdd(s.type)}
              style={({ pressed }) => [styles.suggestRow, pressed && { opacity: 0.7 }]}
              testID={`capability-suggest-${s.id}`}
            >
              <View style={styles.suggestIcon}>
                <Plus size={12} color={Colors.sageDeep} strokeWidth={2.25} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestTitle}>{s.title}</Text>
                <Text style={styles.suggestSub}>{s.sub}</Text>
              </View>
              <ChevronRight size={13} color={Colors.inkFaint} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.creamSoft,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  headerExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  headerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: Colors.inkMuted,
    marginBottom: 2,
  },
  headerText: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  listCard: {
    backgroundColor: Colors.paper,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
    borderColor: Colors.border,
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSoft,
  },
  suggestIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestTitle: { fontSize: 14, color: Colors.ink, fontWeight: "600", marginBottom: 2 },
  suggestSub: { fontSize: 12, color: Colors.inkMuted, lineHeight: 16 },
  fullPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.creamSoft,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: 22,
  },
  fullText: { fontSize: 13, color: Colors.ink, fontWeight: "500", flex: 1 },
});
