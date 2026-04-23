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
