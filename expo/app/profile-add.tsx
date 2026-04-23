import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Locate, MapPin, Search, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useSettings } from "@/providers/SettingsProvider";
import {
  getCurrentLocation,
  requestLocationPermission,
} from "@/lib/location";
import { searchPlaces, type MapKitPlace } from "@/lib/mapkit";
import type {
  HouseholdMember,
  MemoryCategory,
  Weekday,
  WorkSituation,
} from "@/types";

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
  | "note"
  | "memory";

const KIND_OPTIONS: HouseholdMember["kind"][] = ["partner", "child", "pet", "other"];
const WORK_MODES: WorkSituation["mode"][] = [
  "remote",
  "hybrid",
  "office",
  "flexible",
  "student",
  "caregiver",
  "stay_at_home",
  "unemployed",
  "retired",
  "other",
];
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
const MEMORY_CATEGORIES: MemoryCategory[] = [
  "preference",
  "fact",
  "routine",
  "health",
  "relationship",
  "other",
];

const TITLES: Record<AddType, string> = {
  name: "Your name",
  work: "Your days",
  energy: "Energy patterns",
  household: "Add someone",
  location: "Add a place",
  anchor: "Add an anchor",
  rule: "Add a tendency",
  obligation: "Recurring item",
  duration: "Task duration",
  note: "Add a note",
  memory: "Remember this",
};

const SUBTITLES: Record<AddType, string> = {
  name: "What should I call you?",
  work: "What fills most of your days? Work, school, caregiving — whatever fits.",
  energy: "When do you feel sharpest? Example: \"Sharp mornings, afternoon dip, second wind after dinner.\"",
  household: "Partner, kid, pet, or other. Birthday is optional.",
  location: "Search by name or address — I'll save the real pin.",
  anchor: "Fixed day and time commitment. I plan around it.",
  rule: "How you like to work. One line. I'll honor it in every plan.",
  obligation: "Repeats on a cadence without a set time — grooming, vet, refills.",
  duration: "How long a kind of task usually takes you.",
  note: "Anything else I should keep in mind.",
  memory: "A durable fact about you I should remember.",
};

function prettyMode(mode: WorkSituation["mode"]): string {
  if (mode === "stay_at_home") return "Stay-at-home";
  return mode[0].toUpperCase() + mode.slice(1);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function ProfileAddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; edit_id?: string }>();
  const type = (params.type as AddType) ?? "note";
  const editId = typeof params.edit_id === "string" ? params.edit_id : null;
  const {
    profile,
    merge,
    addHousehold,
    updateHousehold,
    addLocation,
    addAnchor,
    addRule,
    addObligation,
    addDuration,
    addNote,
    addMemory,
  } = useProfile();
  const { settings, update } = useSettings();

  const editingMember = useMemo(
    () =>
      editId && type === "household"
        ? profile.household.find((h) => h.id === editId) ?? null
        : null,
    [editId, type, profile.household]
  );

  const [text, setText] = useState<string>(
    editingMember?.name ?? ""
  );
  const [sub, setSub] = useState<string>(editingMember?.detail ?? "");
  const [kind, setKind] = useState<HouseholdMember["kind"]>(editingMember?.kind ?? "child");
  const [workMode, setWorkMode] = useState<WorkSituation["mode"] | null>(
    profile.work.mode === "unspecified" ? null : profile.work.mode
  );
  const [workHours, setWorkHours] = useState<string>(profile.work.typical_hours ?? "");
  const [time, setTime] = useState<string>("");
  const [buffer, setBuffer] = useState<string>("");
  const [days, setDays] = useState<Weekday[]>([]);
  const [cadence, setCadence] = useState<string>(CADENCES[2]);
  const [minutes, setMinutes] = useState<string>("");
  const [memCategory, setMemCategory] = useState<MemoryCategory>("fact");

  // Birthday (household)
  const initialBday = editingMember?.birthday ?? null;
  const [bdayMonth, setBdayMonth] = useState<number | null>(
    initialBday ? parseInt(initialBday.split("-")[initialBday.split("-").length === 3 ? 1 : 0], 10) : null
  );
  const [bdayDay, setBdayDay] = useState<string>(
    initialBday ? initialBday.split("-")[initialBday.split("-").length === 3 ? 2 : 1] : ""
  );

  // Location state
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [locationQuery, setLocationQuery] = useState<string>("");
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<MapKitPlace[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const toggleDay = useCallback((d: Weekday) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }, []);

  const handleSearch = useCallback(async () => {
    const q = locationQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    if (!settings.mapkit_token) {
      setSearching(false);
      setSearchError(
        "Apple Maps isn't connected yet. Add your MapKit token in Settings to search by name."
      );
      setSearchResults([]);
      return;
    }
    const results = await searchPlaces(q, settings.mapkit_token);
    setSearching(false);
    if (results.length === 0) {
      setSearchError("No results. Try a more specific name or include the city.");
      setSearchResults([]);
      return;
    }
    setSearchResults(results);
  }, [locationQuery, settings.mapkit_token]);

  const handlePickResult = useCallback(
    (place: MapKitPlace) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      setAddressLat(place.latitude);
      setAddressLng(place.longitude);
      setResolvedAddress(place.formattedAddress || place.name);
      setLocationQuery(place.name);
      setSearchResults([]);
      setSearchError(null);
      if (!text.trim()) setText(place.name);
    },
    [text]
  );

  const handleUseCurrent = useCallback(async () => {
    const granted = await requestLocationPermission();
    if (!granted) {
      update({ location_enabled: false });
      if (Platform.OS !== "web") {
        Alert.alert(
          "Location needed",
          "Enable location in Settings so I can fill in where you are."
        );
      }
      return;
    }
    update({ location_enabled: true });
    setSearching(true);
    setSearchError(null);
    const hit = await getCurrentLocation();
    setSearching(false);
    if (hit) {
      setAddressLat(hit.latitude);
      setAddressLng(hit.longitude);
      setResolvedAddress(hit.address);
      setLocationQuery(hit.address);
      setSearchResults([]);
    } else {
      setSearchError("Couldn't get your location. Try again in a moment.");
    }
  }, [update]);

  const birthdayISO = useMemo<string | null>(() => {
    if (!bdayMonth || !bdayDay) return null;
    const d = parseInt(bdayDay, 10);
    if (!Number.isFinite(d) || d < 1 || d > 31) return null;
    return `${String(bdayMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }, [bdayMonth, bdayDay]);

  const canSave = useMemo(() => {
    switch (type) {
      case "name":
      case "energy":
      case "rule":
      case "note":
      case "memory":
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
            mode: workMode ?? "unspecified",
            typical_hours: workHours.trim() || null,
            notes: profile.work.notes,
          },
        });
        break;
      case "energy":
        merge({ energy_pattern: text.trim() });
        break;
      case "household":
        if (editingMember) {
          updateHousehold(editingMember.id, {
            name: text.trim(),
            kind,
            detail: sub.trim() || null,
            birthday: birthdayISO,
          });
        } else {
          addHousehold({
            name: text.trim(),
            kind,
            detail: sub.trim() || null,
            birthday: birthdayISO,
          });
        }
        break;
      case "location":
        addLocation({
          label: text.trim(),
          address: resolvedAddress.trim() || locationQuery.trim() || null,
          latitude: addressLat,
          longitude: addressLng,
          notes: null,
        });
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
      case "memory":
        addMemory({ text: text.trim(), category: memCategory, source: "manual" });
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
    memCategory,
    addressLat,
    addressLng,
    resolvedAddress,
    locationQuery,
    birthdayISO,
    editingMember,
    profile.work.notes,
    merge,
    addHousehold,
    updateHousehold,
    addLocation,
    addAnchor,
    addRule,
    addObligation,
    addDuration,
    addNote,
    addMemory,
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
          <Text style={styles.headerTitle}>
            {editingMember ? `Edit ${editingMember.name}` : TITLES[type]}
          </Text>
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

          {(type === "name" ||
            type === "energy" ||
            type === "rule" ||
            type === "note" ||
            type === "memory") && (
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                type === "name"
                  ? "Britt"
                  : type === "energy"
                    ? "Sharp mornings, afternoon dip"
                    : type === "rule"
                      ? "No meetings after 4pm"
                      : type === "memory"
                        ? "I have a golden retriever named Biscuit"
                        : "Anything I should know"
              }
              placeholderTextColor={Colors.inkFaint}
              style={styles.bigInput}
              multiline
              autoFocus
            />
          )}

          {type === "memory" && (
            <>
              <Label text="Category" />
              <View style={styles.chipRow}>
                {MEMORY_CATEGORIES.map((c) => {
                  const on = memCategory === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        setMemCategory(c);
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {c[0].toUpperCase() + c.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
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
                        {prettyMode(m)}
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
                autoFocus={!editingMember}
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
              <Label text="Birthday (optional)" />
              <View style={styles.bdayRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                  style={{ flex: 1 }}
                >
                  {MONTHS.map((m, i) => {
                    const on = bdayMonth === i + 1;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => {
                          if (Platform.OS !== "web") Haptics.selectionAsync();
                          setBdayMonth(on ? null : i + 1);
                        }}
                        style={[styles.monthChip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{m}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <TextInput
                  value={bdayDay}
                  onChangeText={(v) => setBdayDay(v.replace(/[^0-9]/g, "").slice(0, 2))}
                  placeholder="Day"
                  placeholderTextColor={Colors.inkFaint}
                  keyboardType="number-pad"
                  style={styles.bdayDayInput}
                />
              </View>
            </>
          )}

          {type === "location" && (
            <LocationEditor
              label={text}
              onLabelChange={setText}
              query={locationQuery}
              onQueryChange={(v) => {
                setLocationQuery(v);
                setSearchError(null);
                if (addressLat != null || addressLng != null) {
                  setAddressLat(null);
                  setAddressLng(null);
                  setResolvedAddress("");
                }
              }}
              onSearch={handleSearch}
              onUseCurrent={handleUseCurrent}
              searching={searching}
              results={searchResults}
              onPickResult={handlePickResult}
              errorText={searchError}
              resolvedAddress={resolvedAddress}
              hasPin={addressLat != null && addressLng != null}
              mapkitConnected={!!settings.mapkit_token}
            />
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
              <Label text={`Time ${settings.time_format === "24h" ? "(24-hour)" : "(24-hour, e.g. 15:30 = 3:30 PM)"}`} />
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

function LocationEditor({
  label,
  onLabelChange,
  query,
  onQueryChange,
  onSearch,
  onUseCurrent,
  searching,
  results,
  onPickResult,
  errorText,
  resolvedAddress,
  hasPin,
  mapkitConnected,
}: {
  label: string;
  onLabelChange: (s: string) => void;
  query: string;
  onQueryChange: (s: string) => void;
  onSearch: () => void;
  onUseCurrent: () => void;
  searching: boolean;
  results: MapKitPlace[];
  onPickResult: (p: MapKitPlace) => void;
  errorText: string | null;
  resolvedAddress: string;
  hasPin: boolean;
  mapkitConnected: boolean;
}) {
  return (
    <>
      <Label text="Label" />
      <TextInput
        value={label}
        onChangeText={onLabelChange}
        placeholder="Home, Office, School, Gym"
        placeholderTextColor={Colors.inkFaint}
        style={styles.input}
        autoFocus
      />
      <Label text="Find the place" />
      <View style={styles.addressRow}>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Rock Ridge Elementary, 123 Main St…"
          placeholderTextColor={Colors.inkFaint}
          style={[styles.input, { flex: 1 }]}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        <Pressable
          onPress={onSearch}
          style={styles.geoBtn}
          hitSlop={8}
          disabled={!query.trim() || searching}
          testID="geocode-btn"
        >
          {searching ? (
            <ActivityIndicator size="small" color={Colors.sageDeep} />
          ) : (
            <Search size={16} color={Colors.sageDeep} strokeWidth={2} />
          )}
        </Pressable>
      </View>
      <Pressable onPress={onUseCurrent} style={styles.currentBtn} testID="use-current-btn">
        <Locate size={14} color={Colors.sageDeep} strokeWidth={2} />
        <Text style={styles.currentBtnText}>Use current location</Text>
      </Pressable>

      {!mapkitConnected && (
        <View style={styles.mapkitNote}>
          <Text style={styles.mapkitNoteText}>
            Tip: connect Apple Maps in Settings to search by name (like &ldquo;Rock Ridge
            Elementary&rdquo;) and unlock drive-time awareness later.
          </Text>
        </View>
      )}

      {results.length > 0 && (
        <View style={styles.resultList}>
          {results.slice(0, 8).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => onPickResult(r)}
              style={({ pressed }) => [
                styles.resultRow,
                pressed && { backgroundColor: Colors.creamSoft },
              ]}
              testID={`mapkit-result-${r.id}`}
            >
              <MapPin size={14} color={Colors.sageDeep} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {r.name}
                </Text>
                {r.formattedAddress !== "" && (
                  <Text style={styles.resultAddr} numberOfLines={1}>
                    {r.formattedAddress}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {hasPin && resolvedAddress !== "" && (
        <View style={styles.geoHint}>
          <MapPin size={12} color={Colors.sageDeep} strokeWidth={2} />
          <Text style={styles.geoHintText} numberOfLines={2}>
            Pinned — {resolvedAddress}
          </Text>
        </View>
      )}

      {errorText && <Text style={styles.geoMiss}>{errorText}</Text>}
    </>
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
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
  },
  bdayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bdayDayInput: {
    width: 64,
    fontSize: 15,
    color: Colors.ink,
    backgroundColor: Colors.paper,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: "center",
  },
  addressRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  geoBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  currentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
  },
  currentBtnText: {
    fontSize: 13,
    color: Colors.sageDeep,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  mapkitNote: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.creamSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  mapkitNoteText: {
    fontSize: 12,
    color: Colors.inkSoft,
    lineHeight: 17,
  },
  resultList: {
    marginTop: 12,
    backgroundColor: Colors.paper,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSoft,
    overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  resultName: {
    fontSize: 14,
    color: Colors.ink,
    fontWeight: "600",
  },
  resultAddr: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  geoHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  geoHintText: {
    flex: 1,
    fontSize: 12,
    color: Colors.sageDark,
    fontWeight: "500",
  },
  geoMiss: {
    marginTop: 10,
    fontSize: 12,
    color: Colors.amber,
    fontStyle: "italic",
    lineHeight: 17,
  },
});
