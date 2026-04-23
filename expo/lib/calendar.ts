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

export async function findWritableCalendarId(
  preferredId: string | null
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const cals = await listCalendars();
    if (preferredId) {
      const pref = cals.find((c) => c.id === preferredId && c.allowsModifications);
      if (pref) return pref.id;
    }
    const primary = cals.find((c) => c.allowsModifications && c.isPrimary);
    if (primary) return primary.id;
    const anyWritable = cals.find((c) => c.allowsModifications);
    return anyWritable?.id ?? null;
  } catch (e) {
    console.log("[calendar] find writable error:", e);
    return null;
  }
}

export async function createCalendarEvent(params: {
  title: string;
  start: Date;
  end: Date;
  notes?: string | null;
  calendarId?: string | null;
}): Promise<string | null> {
  if (Platform.OS === "web") {
    console.log("[calendar] create event not supported on web");
    return null;
  }
  try {
    const calendarId = await findWritableCalendarId(params.calendarId ?? null);
    if (!calendarId) {
      console.log("[calendar] no writable calendar");
      return null;
    }
    const id = await Calendar.createEventAsync(calendarId, {
      title: params.title,
      startDate: params.start,
      endDate: params.end,
      notes: params.notes ?? undefined,
    });
    console.log("[calendar] created event:", id, params.title);
    return id;
  } catch (e) {
    console.log("[calendar] create event error:", e);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await Calendar.deleteEventAsync(eventId);
    return true;
  } catch (e) {
    console.log("[calendar] delete event error:", e);
    return false;
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
