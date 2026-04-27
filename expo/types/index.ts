export type TaskType =
  | "fixed_anchor"
  | "committed_block"
  | "floatable"
  | "energy_matched"
  | "reactive"
  | "aspirational"
  | "project"
  | "unclassified";

export type EnergyLevel = "deep" | "light" | null;

export type Task = {
  id: string;
  raw_input: string;
  title: string;
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
  last_surfaced_at: string | null;
  snooze_until: string | null;
  due_date: string | null;
  task_type: TaskType;
  energy_level: EnergyLevel;
  window_start: string | null;
  window_end: string | null;
  is_self_care: boolean;
  parent_task_id: string | null;
  cadence: string | null;
  needs_classification: boolean;
  pending_question: string | null;
};

export const TASK_TYPE_META: Record<
  Exclude<TaskType, "unclassified">,
  { label: string; blurb: string }
> = {
  fixed_anchor: {
    label: "Fixed anchors",
    blurb: "Non-negotiable, time-specific. Everything routes around these.",
  },
  committed_block: {
    label: "Committed blocks",
    blurb: "Scheduled, but could shift with reason and coordination.",
  },
  floatable: {
    label: "Floatable",
    blurb: "Needs to happen this week — slot into open time.",
  },
  energy_matched: {
    label: "Energy-matched",
    blurb: "Timing depends on how much brain you have.",
  },
  reactive: {
    label: "Follow-ups",
    blurb: "Downstream of something else. Captured so nothing falls through.",
  },
  aspirational: {
    label: "Aspirational",
    blurb: "What you want to make room for, even when life gets busy.",
  },
  project: {
    label: "Projects",
    blurb: "Bigger undertakings that need a plan and multiple tasks to finish.",
  },
};

export const TASK_TYPE_ORDER: Exclude<TaskType, "unclassified">[] = [
  "fixed_anchor",
  "committed_block",
  "floatable",
  "energy_matched",
  "reactive",
  "aspirational",
  "project",
];

export type PlanItem = {
  task_id: string;
  rationale: string;
  suggested_time_window: string;
  start_time: string | null;
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

export type TimeFormat = "12h" | "24h";

export type Settings = {
  onboarded: boolean;
  notification_time: string;
  calendar_enabled: boolean;
  calendar_write_enabled: boolean;
  selected_calendar_ids: string[];
  default_write_calendar_id: string | null;
  notification_mode: "anchored" | "fixed";
  adaptive_content: boolean;
  midday_nudges: boolean;
  chat_last_cleared_at: string | null;
  location_enabled: boolean;
  time_format: TimeFormat;
  mapkit_token: string | null;
  last_auto_plan_date: string | null;
};

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type HouseholdMember = {
  id: string;
  kind: "partner" | "child" | "pet" | "other";
  name: string;
  detail: string | null;
  birthday: string | null;
};

export type NamedLocation = {
  id: string;
  label: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
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
  mode:
    | "remote"
    | "hybrid"
    | "office"
    | "flexible"
    | "student"
    | "caregiver"
    | "stay_at_home"
    | "unemployed"
    | "retired"
    | "other"
    | "unspecified";
  typical_hours: string | null;
  notes: string | null;
};

export type MemoryCategory =
  | "preference"
  | "fact"
  | "routine"
  | "health"
  | "relationship"
  | "other";

export type Memory = {
  id: string;
  text: string;
  category: MemoryCategory;
  created_at: string;
  source: "chat" | "manual" | "onboarding";
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
  memories: Memory[];
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
  memories: [],
  updated_at: new Date(0).toISOString(),
};

export type ChatActionKind =
  | "answer"
  | "add_task"
  | "save_memory"
  | "add_anchor"
  | "add_recurring"
  | "add_rule"
  | "add_household"
  | "add_location"
  | "do_reshape"
  | "propose_reshape"
  | "create_calendar_event";

export type ChatAction =
  | { kind: "answer" }
  | {
      kind: "add_task";
      raw: string;
      due_date: string | null;
      snooze_until: string | null;
      confirmation: string;
    }
  | {
      kind: "save_memory";
      text: string;
      category: MemoryCategory;
      confirmation: string;
    }
  | {
      kind: "add_anchor";
      title: string;
      time: string | null;
      days: Weekday[];
      buffer_minutes: number | null;
      confirmation: string;
    }
  | {
      kind: "add_recurring";
      title: string;
      cadence: string;
      confirmation: string;
    }
  | { kind: "add_rule"; text: string; confirmation: string }
  | {
      kind: "add_household";
      name: string;
      relation: "partner" | "child" | "pet" | "other";
      detail: string | null;
      confirmation: string;
    }
  | {
      kind: "add_location";
      label: string;
      address: string | null;
      confirmation: string;
    }
  | { kind: "do_reshape"; summary: string }
  | { kind: "propose_reshape"; summary: string; details: string }
  | {
      kind: "create_calendar_event";
      title: string;
      start_time: string;
      end_time: string;
      confirmation: string;
    };

export type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
  created_at: string;
  actions?: ChatAction[];
  applied_action_ids?: string[];
  pending_confirm?: boolean;
};
