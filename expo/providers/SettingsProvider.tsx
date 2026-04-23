import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Settings } from "@/types";

const STORAGE_KEY = "drift:settings:v1";

const DEFAULTS: Settings = {
  onboarded: false,
  notification_time: "07:00",
  calendar_enabled: false,
  selected_calendar_ids: [],
  notification_mode: "anchored",
  adaptive_content: true,
  midday_nudges: true,
};

async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch (e) {
    console.log("[settings] load error:", e);
    return DEFAULTS;
  }
}

async function persist(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.log("[settings] persist error:", e);
  }
}

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const query = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: loadSettings,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (query.data && !hydrated) {
      setSettings(query.data);
      setHydrated(true);
    }
  }, [query.data, hydrated]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  return useMemo(
    () => ({ settings, update, hydrated }),
    [settings, update, hydrated]
  );
});
