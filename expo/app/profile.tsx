import { Stack, useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Anchor as AnchorIcon,
  Brain,
  ChevronRight,
  MapPin,
  NotebookPen,
  Plus,
  Repeat,
  Scale,
  Timer,
  Trash2,
  Users,
} from "lucide-react-native";
import { Colors } from "@/constants/colors";
import { useProfile } from "@/providers/ProfileProvider";
import type { Weekday } from "@/types";

const DAY_LABEL: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function formatDays(days: Weekday[]): string {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && days.every((d) => !["sat", "sun"].includes(d))) return "Weekdays";
  if (days.length === 2 && days.every((d) => ["sat", "sun"].includes(d))) return "Weekends";
  return days.map((d) => DAY_LABEL[d]).join("/");
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    profile,
    removeHousehold,
    removeLocation,
    removeAnchor,
    removeRule,
    removeObligation,
    removeDuration,
    removeNote,
    removeMemory,
  } = useProfile();

  const confirmRemove = useCallback((label: string, onConfirm: () => void) => {
    if (Platform.OS === "web") {
      onConfirm();
      return;
    }
    Alert.alert("Remove?", label, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onConfirm();
        },
      },
    ]);
  }, []);

  const goAdd = useCallback(
    (type: string) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      router.push({ pathname: "/profile-add", params: { type } });
    },
    [router]
  );

  return (
    <>
      <Stack.Screen options={{ title: "What I know", headerLargeTitle: false }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 48,
          paddingHorizontal: 20,
        }}
      >
        <Text style={styles.intro}>
          Everything I use to plan your day. Changes take effect on your next plan.
        </Text>

        <Section title="You" icon={<Users size={14} color={Colors.sageDeep} strokeWidth={2} />}>
          <KVRow
            label="Name"
            value={profile.name ?? "Not set"}
            onPress={() => goAdd("name")}
            muted={!profile.name}
          />
          <KVRow
            label="Work / days"
            value={
              profile.work.mode === "unspecified"
                ? "Not set"
                : `${prettyMode(profile.work.mode)}${
                    profile.work.typical_hours ? ` · ${profile.work.typical_hours}` : ""
                  }`
            }
            onPress={() => goAdd("work")}
            muted={profile.work.mode === "unspecified"}
          />
          <KVRow
            label="Energy pattern"
            value={profile.energy_pattern ?? "Not set"}
            onPress={() => goAdd("energy")}
            muted={!profile.energy_pattern}
          />
        </Section>

        <Section
          title="What I know about you"
          icon={<Brain size={14} color={Colors.sageDeep} strokeWidth={2} />}
          onAdd={() => goAdd("memory")}
          definition="Things I've learned from our chats. Edit or delete anything."
        >
          {profile.memories.length === 0 ? (
            <EmptyRow text="Nothing saved yet. As we talk, I'll remember the important things." />
          ) : (
            profile.memories.map((m) => (
              <ItemRow
                key={m.id}
                title={m.text}
                sub={`${m.category}${m.source === "chat" ? " · from chat" : ""}`}
                onRemove={() =>
                  confirmRemove("Forget this?", () => removeMemory(m.id))
                }
              />
            ))
          )}
        </Section>

        <Section
          title="Household"
          icon={<Users size={14} color={Colors.sageDeep} strokeWidth={2} />}
          onAdd={() => goAdd("household")}
        >
          {profile.household.length === 0 ? (
            <EmptyRow text="Partner, kids, pets — anyone you plan around." />
          ) : (
            profile.household.map((h) => (
              <ItemRow
                key={h.id}
                title={h.name}
                sub={`${h.kind}${h.detail ? ` · ${h.detail}` : ""}`}
                onRemove={() =>
                  confirmRemove(`Remove ${h.name}?`, () => removeHousehold(h.id))
                }
              />
            ))
          )}
        </Section>

        <Section
          title="Locations"
          icon={<MapPin size={14} color={Colors.sageDeep} strokeWidth={2} />}
          onAdd={() => goAdd("location")}
          definition="Places you go often — unlocks travel buffers in your plan."
        >
          {profile.locations.length === 0 ? (
            <EmptyRow text="Home, work, school, gym." />
          ) : (
            profile.locations.map((l) => (
              <ItemRow
                key={l.id}
                title={l.label}
                sub={l.address ?? l.notes ?? undefined}
                onRemove={() =>
                  confirmRemove(`Remove ${l.label}?`, () => removeLocation(l.id))
                }
              />
            ))
          )}
        </Section>

        <Section
          title="Hard anchors"
          icon={<AnchorIcon size={14} color={Colors.sageDeep} strokeWidth={2} />}
          onAdd={() => goAdd("anchor")}
          definition="Fixed-day, fixed-time commitments. I plan around them — never over them."
        >
          {profile.anchors.length === 0 ? (
            <EmptyRow text="School pickup, therapy, standing meetings." />
          ) : (
            profile.anchors.map((a) => (
              <ItemRow
                key={a.id}
                title={a.title}
                sub={`${a.time ?? "—"} · ${formatDays(a.days)}${
                  a.buffer_minutes ? ` · ${a.buffer_minutes}m buffer` : ""
                }`}
                onRemove={() =>
                  confirmRemove(`Remove ${a.title}?`, () => removeAnchor(a.id))
                }
              />
            ))
          )}
        </Section>

        <Section
          title="Rules"
          icon={<Scale size={14} color={Colors.sageDeep} strokeWidth={2} />}
          onAdd={() => goAdd("rule")}
          definition="Personal constraints I should honor every plan."
        >
          {profile.rules.length === 0 ? (
            <EmptyRow text={`"25 min buffer home to school." "No meetings after 4."`} />
          ) : (
            profile.rules.map((r) => (
              <ItemRow
                key={r.id}
                title={r.text}
                onRemove={() => confirmRemove("Remove this rule?", () => removeRule(r.id))}
              />
            ))
          )}
        </Section>

        <Section
          title="Recurring items"
          icon={<Repeat size={14} color={Colors.sageDeep} strokeWidth={2} />}
          onAdd={() => goAdd("obligation")}
          definition="Things that repeat on a cadence, without a fixed time — grooming, vet, refills."
        >
          {profile.recurring_obligations.length === 0 ? (
            <EmptyRow text="Grooming, vet, med refills — I'll surface these over time." />
          ) : (
            profile.recurring_obligations.map((o) => (
              <ItemRow
                key={o.id}
                title={o.title}
                sub={`${o.cadence}${
                  o.last_done_at
                    ? ` · last ${new Date(o.last_done_at).toLocaleDateString()}`
                    : ""
                }`}
                onRemove={() =>
                  confirmRemove(`Remove ${o.title}?`, () => removeObligation(o.id))
                }
              />
            ))
          )}
        </Section>

        <Section
          title="Typical durations"
          icon={<Timer size={14} color={Colors.sageDeep} strokeWidth={2} />}
          onAdd={() => goAdd("duration")}
        >
          {profile.task_durations.length === 0 ? (
            <EmptyRow text={`"Dishes: 10 min." "Pull weeds: cap at 20 min."`} />
          ) : (
            profile.task_durations.map((d) => (
              <ItemRow
                key={d.id}
                title={d.task_pattern}
                sub={`${d.minutes} min`}
                onRemove={() =>
                  confirmRemove(`Remove ${d.task_pattern}?`, () => removeDuration(d.id))
                }
              />
            ))
          )}
        </Section>

        <Section
          title="Notes"
          icon={<NotebookPen size={14} color={Colors.sageDeep} strokeWidth={2} />}
          onAdd={() => goAdd("note")}
        >
          {profile.notes.length === 0 ? (
            <EmptyRow text="Anything else I should keep in mind." />
          ) : (
            profile.notes.map((n, i) => (
              <ItemRow
                key={`${i}-${n.slice(0, 8)}`}
                title={n}
                onRemove={() => confirmRemove("Remove this note?", () => removeNote(i))}
              />
            ))
          )}
        </Section>
      </ScrollView>
    </>
  );
}

function prettyMode(mode: string): string {
  if (mode === "stay_at_home") return "Stay-at-home";
  if (mode === "unspecified") return "Not set";
  return mode[0].toUpperCase() + mode.slice(1);
}

function Section({
  title,
  icon,
  onAdd,
  definition,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onAdd?: () => void;
  definition?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          {icon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {onAdd && (
          <Pressable onPress={onAdd} style={styles.addBtn} hitSlop={8} testID={`add-${title}`}>
            <Plus size={14} color={Colors.sageDeep} strokeWidth={2.25} />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
      {definition && <Text style={styles.definition}>{definition}</Text>}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function KVRow({
  label,
  value,
  onPress,
  muted,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
        <Text style={[styles.kvValue, muted && { color: Colors.inkMuted }]} numberOfLines={1}>
          {value}
        </Text>
        {onPress && <ChevronRight size={14} color={Colors.inkFaint} strokeWidth={2} />}
      </View>
    </Pressable>
  );
}

function ItemRow({
  title,
  sub,
  onRemove,
}: {
  title: string;
  sub?: string;
  onRemove: () => void;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        {sub && <Text style={styles.itemSub}>{sub}</Text>}
      </View>
      <Pressable onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
        <Trash2 size={16} color={Colors.inkFaint} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <Text style={styles.emptyRow}>{text}</Text>;
}

const styles = StyleSheet.create({
  intro: {
    fontSize: 13,
    color: Colors.inkSoft,
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.inkSoft,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  definition: {
    fontSize: 12,
    color: Colors.inkMuted,
    paddingHorizontal: 4,
    marginBottom: 8,
    lineHeight: 16,
    fontStyle: "italic",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.creamSoft,
  },
  addBtnText: {
    fontSize: 12,
    color: Colors.sageDeep,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  sectionBody: {
    backgroundColor: Colors.paper,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSoft,
    overflow: "hidden",
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  kvLabel: { fontSize: 14, color: Colors.ink, fontWeight: "500" },
  kvValue: { fontSize: 14, color: Colors.sageDeep, fontWeight: "600", flexShrink: 1 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  itemTitle: { fontSize: 14, color: Colors.ink, fontWeight: "500", lineHeight: 19 },
  itemSub: { fontSize: 12, color: Colors.inkMuted, marginTop: 3, lineHeight: 16 },
  removeBtn: { padding: 6 },
  emptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13,
    color: Colors.inkMuted,
    fontStyle: "italic",
    lineHeight: 18,
  },
});
