import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_PROFILE,
  type Anchor,
  type HouseholdMember,
  type NamedLocation,
  type RecurringObligation,
  type Rule,
  type TaskDuration,
  type UserProfile,
} from "@/types";

const STORAGE_KEY = "drift:profile:v1";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function loadProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return { ...EMPTY_PROFILE, ...parsed };
  } catch (e) {
    console.log("[profile] load error:", e);
    return EMPTY_PROFILE;
  }
}

async function persist(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.log("[profile] persist error:", e);
  }
}

function bump(profile: UserProfile): UserProfile {
  return { ...profile, updated_at: new Date().toISOString() };
}

export const [ProfileProvider, useProfile] = createContextHook(() => {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const query = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: loadProfile,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (query.data && !hydrated) {
      setProfile(query.data);
      setHydrated(true);
    }
  }, [query.data, hydrated]);

  const save = useCallback((updater: (prev: UserProfile) => UserProfile) => {
    setProfile((prev) => {
      const next = bump(updater(prev));
      persist(next);
      return next;
    });
  }, []);

  const merge = useCallback(
    (patch: Partial<UserProfile>) => {
      save((prev) => ({ ...prev, ...patch }));
    },
    [save]
  );

  const addHousehold = useCallback(
    (m: Omit<HouseholdMember, "id">) => {
      save((prev) => ({
        ...prev,
        household: [...prev.household, { ...m, id: uid("hh") }],
      }));
    },
    [save]
  );

  const updateHousehold = useCallback(
    (id: string, patch: Partial<HouseholdMember>) => {
      save((prev) => ({
        ...prev,
        household: prev.household.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      }));
    },
    [save]
  );

  const removeHousehold = useCallback(
    (id: string) => {
      save((prev) => ({
        ...prev,
        household: prev.household.filter((h) => h.id !== id),
      }));
    },
    [save]
  );

  const addLocation = useCallback(
    (l: Omit<NamedLocation, "id">) => {
      save((prev) => ({ ...prev, locations: [...prev.locations, { ...l, id: uid("loc") }] }));
    },
    [save]
  );
  const updateLocation = useCallback(
    (id: string, patch: Partial<NamedLocation>) => {
      save((prev) => ({
        ...prev,
        locations: prev.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }));
    },
    [save]
  );
  const removeLocation = useCallback(
    (id: string) => {
      save((prev) => ({ ...prev, locations: prev.locations.filter((l) => l.id !== id) }));
    },
    [save]
  );

  const addAnchor = useCallback(
    (a: Omit<Anchor, "id">) => {
      save((prev) => ({ ...prev, anchors: [...prev.anchors, { ...a, id: uid("anc") }] }));
    },
    [save]
  );
  const updateAnchor = useCallback(
    (id: string, patch: Partial<Anchor>) => {
      save((prev) => ({
        ...prev,
        anchors: prev.anchors.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }));
    },
    [save]
  );
  const removeAnchor = useCallback(
    (id: string) => {
      save((prev) => ({ ...prev, anchors: prev.anchors.filter((a) => a.id !== id) }));
    },
    [save]
  );

  const addRule = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      save((prev) => ({ ...prev, rules: [...prev.rules, { id: uid("rl"), text: trimmed }] }));
    },
    [save]
  );
  const removeRule = useCallback(
    (id: string) => {
      save((prev) => ({ ...prev, rules: prev.rules.filter((r) => r.id !== id) }));
    },
    [save]
  );
  const updateRule = useCallback(
    (id: string, patch: Partial<Rule>) => {
      save((prev) => ({
        ...prev,
        rules: prev.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
    },
    [save]
  );

  const addObligation = useCallback(
    (o: Omit<RecurringObligation, "id">) => {
      save((prev) => ({
        ...prev,
        recurring_obligations: [
          ...prev.recurring_obligations,
          { ...o, id: uid("obl") },
        ],
      }));
    },
    [save]
  );
  const updateObligation = useCallback(
    (id: string, patch: Partial<RecurringObligation>) => {
      save((prev) => ({
        ...prev,
        recurring_obligations: prev.recurring_obligations.map((o) =>
          o.id === id ? { ...o, ...patch } : o
        ),
      }));
    },
    [save]
  );
  const removeObligation = useCallback(
    (id: string) => {
      save((prev) => ({
        ...prev,
        recurring_obligations: prev.recurring_obligations.filter((o) => o.id !== id),
      }));
    },
    [save]
  );

  const addDuration = useCallback(
    (d: Omit<TaskDuration, "id">) => {
      save((prev) => ({
        ...prev,
        task_durations: [...prev.task_durations, { ...d, id: uid("dur") }],
      }));
    },
    [save]
  );
  const removeDuration = useCallback(
    (id: string) => {
      save((prev) => ({
        ...prev,
        task_durations: prev.task_durations.filter((d) => d.id !== id),
      }));
    },
    [save]
  );

  const addNote = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      save((prev) => ({ ...prev, notes: [...prev.notes, trimmed] }));
    },
    [save]
  );
  const removeNote = useCallback(
    (idx: number) => {
      save((prev) => ({ ...prev, notes: prev.notes.filter((_, i) => i !== idx) }));
    },
    [save]
  );

  const resetProfile = useCallback(() => {
    save(() => ({ ...EMPTY_PROFILE }));
  }, [save]);

  const capability = useMemo(() => {
    const hasAnchors = profile.anchors.length > 0;
    const hasLocations = profile.locations.length > 0;
    const hasObligations = profile.recurring_obligations.length > 0;
    const hasHousehold = profile.household.length > 0;
    const hasRules = profile.rules.length > 0;
    const tier: "core" | "enhanced" | "full" =
      hasObligations && hasLocations && (hasRules || hasHousehold)
        ? "full"
        : hasLocations || hasRules || hasHousehold
          ? "enhanced"
          : "core";
    return { tier, hasAnchors, hasLocations, hasObligations, hasHousehold, hasRules };
  }, [profile]);

  return useMemo(
    () => ({
      profile,
      hydrated,
      capability,
      merge,
      save,
      addHousehold,
      updateHousehold,
      removeHousehold,
      addLocation,
      updateLocation,
      removeLocation,
      addAnchor,
      updateAnchor,
      removeAnchor,
      addRule,
      updateRule,
      removeRule,
      addObligation,
      updateObligation,
      removeObligation,
      addDuration,
      removeDuration,
      addNote,
      removeNote,
      resetProfile,
    }),
    [
      profile,
      hydrated,
      capability,
      merge,
      save,
      addHousehold,
      updateHousehold,
      removeHousehold,
      addLocation,
      updateLocation,
      removeLocation,
      addAnchor,
      updateAnchor,
      removeAnchor,
      addRule,
      updateRule,
      removeRule,
      addObligation,
      updateObligation,
      removeObligation,
      addDuration,
      removeDuration,
      addNote,
      removeNote,
      resetProfile,
    ]
  );
});
