import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const MORNING_ID = "drift-morning-plan";

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (e) {
    console.log("[notif] permission error:", e);
    return false;
  }
}

export async function scheduleMorningNotification(params: {
  hour: number;
  minute: number;
  title: string;
  body: string;
}): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: {
        title: params.title,
        body: params.body,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: params.hour,
        minute: params.minute,
      },
    });
    console.log("[notif] scheduled morning at %d:%d", params.hour, params.minute);
  } catch (e) {
    console.log("[notif] schedule error:", e);
  }
}

export async function cancelMorningNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(MORNING_ID);
  } catch {}
}

export function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return { hour: Number.isFinite(h) ? h : 7, minute: Number.isFinite(m) ? m : 0 };
}

export function formatTime(hhmm: string): string {
  const { hour, minute } = parseTime(hhmm);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mm = minute.toString().padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}
