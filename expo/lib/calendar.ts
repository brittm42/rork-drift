import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import type { CalendarEventSnapshot } from "@/types";

export async function requestCalendarPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === "granted";
  } catch (e) {
    console.log("[calendar] permission error:", e);
    return false;
  }
}

export async function getCalendarPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
  if (Platform.OS === "web") return "denied";
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status === "granted") return "granted";
    if (status === "denied") return "denied";
    return "undetermined";
  } catch {
    return "undetermined";
  }
}

export async function listCalendars(): Promise<Calendar.Calendar[]> {
  if (Platform.OS === "web") return [];
  try {
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return cals;
  } catch (e) {
    console.log("[calendar] list error:", e);
    return [];
  }
}

export async function getTodayEvents(calendarIds: string[]): Promise<CalendarEventSnapshot[]> {
  if (Platform.OS === "web") return [];
  if (calendarIds.length === 0) return [];
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const events = await Calendar.getEventsAsync(calendarIds, start, end);
    return events.map((e) => ({
      id: e.id,
      title: e.title ?? "(untitled)",
      start_time: new Date(e.startDate as string).toISOString(),
      end_time: new Date(e.endDate as string).toISOString(),
      all_day: !!e.allDay,
    }));
  } catch (e) {
    console.log("[calendar] events error:", e);
    return [];
  }
}

export function getRemainingEvents(events: CalendarEventSnapshot[], now: Date): CalendarEventSnapshot[] {
  return events.filter((e) => new Date(e.end_time).getTime() > now.getTime());
}
