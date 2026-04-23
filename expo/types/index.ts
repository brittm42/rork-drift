export type Task = {
  id: string;
  raw_input: string;
  title: string;
  urgency_flag: boolean;
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
  last_surfaced_at: string | null;
  snooze_until: string | null;
  recurrence_rule: string | null;
  due_date: string | null;
};

export type PlanItem = {
  task_id: string;
  rationale: string;
  suggested_time_window: string;
};

export type CalendarEventSnapshot = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
};

export type DayPlan = {
  id: string;
  date: string;
  header_note: string;
  plan_items: PlanItem[];
  calendar_context: CalendarEventSnapshot[];
  generated_at: string;
  re_routed_at: string | null;
};

export type Settings = {
  onboarded: boolean;
  notification_time: string;
  calendar_enabled: boolean;
  selected_calendar_ids: string[];
  notification_mode: "anchored" | "fixed";
  adaptive_content: boolean;
  midday_nudges: boolean;
};

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type HouseholdMember = {
  id: string;
  kind: "partner" | "child" | "pet" | "other";
  name: string;
  detail: string | null;
};

export type NamedLocation = {
  id: string;
  label: string;
  address: string | null;
  notes: string | null;
};

export type Anchor = {
  id: string;
  title: string;
  time: string | null;
  days: Weekday[];
  location_id: string | null;
  buffer_minutes: number | null;
  notes: string | null;
};

export type Rule = {
  id: string;
  text: string;
};

export type RecurringObligation = {
  id: string;
  title: string;
  cadence: string;
  last_done_at: string | null;
  notes: string | null;
};

export type TaskDuration = {
  id: string;
  task_pattern: string;
  minutes: number;
};

export type WorkSituation = {
  mode: "remote" | "hybrid" | "office" | "flexible" | "unspecified";
  typical_hours: string | null;
  notes: string | null;
};

export type UserProfile = {
  name: string | null;
  household: HouseholdMember[];
  locations: NamedLocation[];
  anchors: Anchor[];
  rules: Rule[];
  recurring_obligations: RecurringObligation[];
  task_durations: TaskDuration[];
  work: WorkSituation;
  energy_pattern: string | null;
  notes: string[];
  updated_at: string;
};

export const EMPTY_PROFILE: UserProfile = {
  name: null,
  household: [],
  locations: [],
  anchors: [],
  rules: [],
  recurring_obligations: [],
  task_durations: [],
  work: { mode: "unspecified", typical_hours: null, notes: null },
  energy_pattern: null,
  notes: [],
  updated_at: new Date(0).toISOString(),
};
