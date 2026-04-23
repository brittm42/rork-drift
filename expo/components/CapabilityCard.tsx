import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight, Lock, Sparkles } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import { useProfile } from "@/providers/ProfileProvider";
import { useSettings } from "@/providers/SettingsProvider";

type Suggestion = {
  id: string;
  type: string;
  title: string;
  sub: string;
  unlocked: boolean;
};

export function CapabilityCard() {
  const router = useRouter();
  const { profile, capability } = useProfile();
  const { settings } = useSettings();
  const [expanded, setExpanded] = useState<boolean>(false);

  const suggestions = useMemo<Suggestion[]>(() => {
    const list: Suggestion[] = [];
    if (profile.locations.length === 0) {
      list.push({
        id: "locations",
        type: "location",
        title: "Add your key locations",
        sub: "So I can factor in travel time to your plan.",
        unlocked: false,
      });
    }
    if (profile.anchors.length === 0) {
      list.push({
        id: "anchors",
        type: "anchor",
        title: "Add a daily anchor",
        sub: "School pickup, therapy — things I should plan around.",
        unlocked: false,
      });
    }
    if (profile.recurring_obligations.length === 0) {
      list.push({
        id: "obligations",
        type: "obligation",
        title: "Add a recurring item",
        sub: "Grooming, vet, refills — I'll surface these over time.",
        unlocked: false,
      });
    }
    if (profile.rules.length === 0) {
      list.push({
        id: "rules",
        type: "rule",
        title: "Add a rule",
        sub: `"25 min buffer home to school." I'll honor it.`,
        unlocked: false,
      });
    }
    if (profile.household.length === 0) {
      list.push({
        id: "household",
        type: "household",
        title: "Tell me who you plan around",
        sub: "Partner, kids, pets. Makes the plan feel like yours.",
        unlocked: false,
      });
    }
    if (!profile.energy_pattern) {
      list.push({
        id: "energy",
        type: "energy",
        title: "Share your energy pattern",
        sub: "Sharp mornings? Afternoon dip? I'll order the day around it.",
        unlocked: false,
      });
    }
    if (settings.calendar_enabled && !settings.calendar_write_enabled) {
      list.push({
        id: "cal-write",
        type: "calendar-write",
        title: "Let me put blocks on your calendar",
        sub: "So when you ask for gym time, it actually shows up there.",
        unlocked: false,
      });
    }
    return list;
  }, [profile, settings.calendar_enabled, settings.calendar_write_enabled]);

  const tierLabel = useMemo(() => {
    if (capability.tier === "full") return "Full context";
    if (capability.tier === "enhanced") return "Do more together";
    return "Just the basics";
  }, [capability.tier]);

  const handleToggle = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setExpanded((v) => !v);
  }, []);

  const handleAdd = useCallback(
    (type: string) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      if (type === "calendar-write") {
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
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}
        testID="capability-card"
      >
        <Sparkles size={13} color={Colors.sageDeep} strokeWidth={2} />
        <Text style={styles.pillText}>Full context · tap to review</Text>
        <ChevronRight size={13} color={Colors.inkMuted} strokeWidth={2} />
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
        testID="capability-card"
      >
        <Sparkles size={13} color={Colors.sageDeep} strokeWidth={2} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pillLabel}>{tierLabel.toUpperCase()}</Text>
          <Text style={styles.pillText}>Tell me more about you</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{suggestions.length}</Text>
        </View>
      </Pressable>

      {expanded && (
        <ExpandedList
          suggestions={suggestions}
          onAdd={handleAdd}
          onOpenProfile={() => router.push("/profile")}
        />
      )}
    </View>
  );
}

function ExpandedList({
  suggestions,
  onAdd,
  onOpenProfile,
}: {
  suggestions: Suggestion[];
  onAdd: (type: string) => void;
  onOpenProfile: () => void;
}) {
  const anim = useMemo(() => new Animated.Value(0), []);
  React.useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) },
        ],
        marginTop: 8,
      }}
    >
      <View style={styles.expandedCard}>
        <Text style={styles.expandedIntro}>
          Tap any one to tell me more. I&apos;ll use it in every plan.
        </Text>
        {suggestions.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onAdd(s.type)}
            style={({ pressed }) => [styles.suggestRow, pressed && { opacity: 0.7 }]}
            testID={`capability-suggest-${s.id}`}
          >
            <View style={styles.suggestIcon}>
              <Lock size={11} color={Colors.inkMuted} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestTitle}>{s.title}</Text>
              <Text style={styles.suggestSub}>{s.sub}</Text>
            </View>
            <ChevronRight size={14} color={Colors.inkFaint} strokeWidth={2} />
          </Pressable>
        ))}
        <Pressable onPress={onOpenProfile} style={styles.viewAllBtn} hitSlop={6}>
          <Text style={styles.viewAllText}>See everything I know</Text>
          <ChevronRight size={12} color={Colors.sageDeep} strokeWidth={2.25} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.creamSoft,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  pillLabel: {
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: Colors.inkMuted,
    marginBottom: 1,
  },
  pillText: {
    fontSize: 13,
    color: Colors.ink,
    fontWeight: "500",
    flex: 1,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: Colors.sageDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.paper,
    letterSpacing: 0.2,
  },
  expandedCard: {
    backgroundColor: Colors.paper,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSoft,
    paddingVertical: 8,
  },
  expandedIntro: {
    fontSize: 12,
    color: Colors.inkMuted,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    fontStyle: "italic",
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
  suggestTitle: {
    fontSize: 14,
    color: Colors.ink,
    fontWeight: "600",
    marginBottom: 2,
  },
  suggestSub: { fontSize: 12, color: Colors.inkMuted, lineHeight: 16 },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSoft,
  },
  viewAllText: {
    fontSize: 12,
    color: Colors.sageDeep,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
