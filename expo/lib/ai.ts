import { createGateway, generateObject } from "ai";
import { z } from "zod";
import type { CalendarEventSnapshot, Task, UserProfile } from "@/types";

const TOOLKIT_URL = process.env.EXPO_PUBLIC_TOOLKIT_URL;
const SECRET_KEY = process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY;

const gateway = createGateway({
  baseURL: `${TOOLKIT_URL}/v2/vercel/v3/ai`,
  apiKey: SECRET_KEY,
});

const SONNET = "anthropic/claude-sonnet-4";
const HAIKU = "anthropic/claude-haiku-4.5";

const taskParseSchema = z.object({
  title: z.string(),
  urgency_flag: z.boolean(),
});

export type ParsedTask = z.infer<typeof taskParseSchema>;

function profileBrief(profile: UserProfile | null | undefined): string {
  if (!profile) return "No profile yet.";
  const parts: string[] = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.household.length) {
    parts.push(
      `Household: ${profile.household
        .map((h) => `${h.name} (${h.kind}${h.detail ? `, ${h.detail}` : ""})`)
        .join("; ")}`
    );
  }
  if (profile.locations.length) {
    parts.push(
      `Locations: ${profile.locations
        .map((l) => `${l.label}${l.address ? ` @ ${l.address}` : ""}`)
        .join("; ")}`
    );
  }
  if (profile.anchors.length) {
    parts.push(
      `Hard anchors: ${profile.anchors
        .map(
          (a) =>
            `${a.title}${a.time ? ` at ${a.time}` : ""} on ${a.days.join("/")}${
              a.buffer_minutes ? ` (${a.buffer_minutes}m buffer)` : ""
            }`
        )
        .join("; ")}`
    );
  }
  if (profile.rules.length) {
    parts.push(`Rules: ${profile.rules.map((r) => r.text).join("; ")}`);
  }
  if (profile.recurring_obligations.length) {
    parts.push(
      `Recurring life admin: ${profile.recurring_obligations
        .map((o) => `${o.title} (${o.cadence})`)
        .join("; ")}`
    );
  }
  if (profile.task_durations.length) {
    parts.push(
      `Typical durations: ${profile.task_durations
        .map((d) => `${d.task_pattern}=${d.minutes}m`)
        .join("; ")}`
    );
  }
  if (profile.work.mode !== "unspecified") {
    parts.push(
      `Work: ${profile.work.mode}${
        profile.work.typical_hours ? `, ${profile.work.typical_hours}` : ""
      }`
    );
  }
  if (profile.energy_pattern) parts.push(`Energy: ${profile.energy_pattern}`);
  if (profile.notes.length) parts.push(`Notes: ${profile.notes.join(" | ")}`);
  return parts.length ? parts.join("\n") : "No profile yet.";
}

export async function parseTaskInput(raw: string, profile?: UserProfile): Promise<ParsedTask> {
  try {
    console.log("[ai] parseTaskInput:", raw);
    const { object } = await generateObject({
      model: gateway(HAIKU),
      schema: taskParseSchema,
      prompt: `Clean up this task for a personal to-do list. Fix typos, normalize capitalization, make it a clear action item. Keep it concise and preserve intent exactly — do not add scope. Extract urgency (true/false) — urgency signals include: "today", "urgent", "ASAP", "now", "by [date/time]", "immediately".

User context (for disambiguation only — do NOT expand the task):
${profileBrief(profile)}

Input: ${JSON.stringify(raw)}`,
    });
    return object;
  } catch (e) {
    console.log("[ai] parseTaskInput failed, falling back to raw:", e);
    return { title: raw.trim(), urgency_flag: false };
  }
}

const planSchema = z.object({
  header: z.string(),
  items: z
    .array(
      z.object({
        task_id: z.string(),
        rationale: z.string(),
        suggested_time_window: z.string(),
      })
    )
    .min(1)
    .max(7),
});

export type GeneratedPlan = z.infer<typeof planSchema>;

type PlanInput = {
  tasks: Task[];
  events: CalendarEventSnapshot[];
  now: Date;
  profile?: UserProfile;
  reroute?: {
    completedToday: string[];
    remainingEvents: CalendarEventSnapshot[];
  };
};

export async function generateDailyPlan(input: PlanInput): Promise<GeneratedPlan> {
  const { tasks, events, now, reroute, profile } = input;
  const incompleteTasks = tasks
    .filter((t) => !t.is_complete)
    .map((t) => ({ id: t.id, title: t.title, urgency_flag: t.urgency_flag }));

  const baseInstructions = `You are a calm, competent daily planner acting as this person's personal chief of staff. Your tone is quiet, confident, forward-looking, never shaming. You respect their life, not just their tasks.

About the person:
${profileBrief(profile)}

Tasks available:
${JSON.stringify(incompleteTasks, null, 2)}

Calendar events today:
${JSON.stringify(events, null, 2)}

Current time: ${now.toISOString()}

Generate a prioritized plan for today:
- Select 3 to 7 tasks (fewer if there are fewer tasks)
- Every task_id MUST come from the Tasks list above — never invent ids
- Never place tasks during calendar event blocks
- Respect hard anchors from the profile (e.g. school pickup): leave buffer time and never schedule conflicting work
- Honor personal rules and energy patterns when ordering the day
- Suggest a natural time window for each task (e.g. "Before your 10am", "After lunch", "Mid-afternoon", "Early evening") — use anchor-relative phrasing when appropriate ("Before pickup", "After drop-off")
- Write a one-line rationale for why each task is on today's plan — warm, specific, reference their life where natural, never generic
- Write a one-line "shape of the day" header (e.g. "Packed morning, open afternoon — front-load the focus work")`;

  const rerouteInstructions = reroute
    ? `\n\nThe user is re-routing mid-day. Current time: ${now.toISOString()}.
Tasks already completed today: ${JSON.stringify(reroute.completedToday)}
Remaining calendar events: ${JSON.stringify(reroute.remainingEvents)}
Reason forward only — acknowledge what's left, never dwell on what didn't happen.`
    : "";

  console.log(
    "[ai] generateDailyPlan tasks=%d events=%d reroute=%s profile=%s",
    incompleteTasks.length,
    events.length,
    !!reroute,
    profile ? "yes" : "no"
  );

  const { object } = await generateObject({
    model: gateway(SONNET),
    schema: planSchema,
    prompt: baseInstructions + rerouteInstructions,
  });

  const validIds = new Set(incompleteTasks.map((t) => t.id));
  object.items = object.items.filter((i) => validIds.has(i.task_id));
  return object;
}

const notifSchema = z.object({
  title: z.string(),
  body: z.string(),
});

export async function generateMorningNotification(params: {
  planHeader: string;
  firstTaskTitle: string | null;
  taskCount: number;
  hasEvents: boolean;
}): Promise<{ title: string; body: string }> {
  try {
    const { object } = await generateObject({
      model: gateway(HAIKU),
      schema: notifSchema,
      prompt: `Write a calm, confident morning notification for Drift.
Plan header: ${JSON.stringify(params.planHeader)}
First task: ${JSON.stringify(params.firstTaskTitle)}
Task count: ${params.taskCount}
Has calendar events today: ${params.hasEvents}

Title: 3-5 words, warm, no emojis.
Body: one short sentence previewing the first task. Never shaming. Never cheerful.`,
    });
    return object;
  } catch (e) {
    console.log("[ai] notification fallback:", e);
    return {
      title: "Your day is planned",
      body: params.firstTaskTitle
        ? `${params.taskCount} tasks today, starting with: ${params.firstTaskTitle}`
        : "Open Drift to see what's next.",
    };
  }
}

const WEEKDAYS = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const onboardingExtractSchema = z.object({
  name: z.string().nullable(),
  household: z.array(
    z.object({
      kind: z.enum(["partner", "child", "pet", "other"]),
      name: z.string(),
      detail: z.string().nullable(),
    })
  ),
  anchors: z.array(
    z.object({
      title: z.string(),
      time: z.string().nullable(),
      days: z.array(WEEKDAYS),
      buffer_minutes: z.number().nullable(),
      notes: z.string().nullable(),
    })
  ),
  work: z
    .object({
      mode: z.enum(["remote", "hybrid", "office", "flexible", "unspecified"]),
      typical_hours: z.string().nullable(),
    })
    .nullable(),
  rules: z.array(z.string()),
  energy_pattern: z.string().nullable(),
  notes: z.array(z.string()),
});

export type OnboardingExtract = z.infer<typeof onboardingExtractSchema>;

export type OnboardingTopic =
  | "name"
  | "household"
  | "work"
  | "anchors"
  | "rules_energy"
  | "open";

export async function extractOnboardingFacts(params: {
  topic: OnboardingTopic;
  userMessage: string;
  currentProfile: UserProfile;
}): Promise<OnboardingExtract> {
  const { topic, userMessage, currentProfile } = params;
  const empty: OnboardingExtract = {
    name: null,
    household: [],
    anchors: [],
    work: null,
    rules: [],
    energy_pattern: null,
    notes: [],
  };
  try {
    const { object } = await generateObject({
      model: gateway(HAIKU),
      schema: onboardingExtractSchema,
      prompt: `You are extracting structured facts from a short reply during an onboarding chat for a personal planning app. Only return facts the user actually stated. If the reply is skip/none/unsure, return empty arrays and nulls. Never invent details. Use null (not empty string) when unknown.

Current known profile:
${profileBrief(currentProfile)}

Current topic: ${topic}
User reply: ${JSON.stringify(userMessage)}

Rules:
- name: only if this topic is "name" or they clearly stated their name.
- household: people/pets they live with. kind = partner | child | pet | other. detail can include age, school, breed, or schedule shorthand.
- anchors: recurring commitments with a fixed day/time like "school pickup 3:30 M-F", "therapy Thursdays 10am". days use mon/tue/wed/thu/fri/sat/sun. time is "HH:MM" 24h or null if unclear. buffer_minutes only if they stated it.
- work: mode from remote/hybrid/office/flexible/unspecified; typical_hours like "9-5" if stated.
- rules: short imperative strings like "25 min buffer from gym to school", "no meetings after 4pm".
- energy_pattern: short phrase if stated ("sharp mornings, afternoon dip").
- notes: catch-all for useful context that doesn't fit the above.`,
    });
    return object;
  } catch (e) {
    console.log("[ai] extractOnboardingFacts failed:", e);
    return empty;
  }
}

const summarySchema = z.object({
  opener: z.string(),
  bullets: z.array(z.string()).min(1).max(6),
  closer: z.string(),
});

export type OnboardingSummary = z.infer<typeof summarySchema>;

export async function summarizeOnboarding(profile: UserProfile): Promise<OnboardingSummary> {
  try {
    const { object } = await generateObject({
      model: gateway(HAIKU),
      schema: summarySchema,
      prompt: `Write a short, warm reflection for a personal planning app. You are confirming what you learned about the user during onboarding, so they feel understood. Tone: calm, confident, slightly warm. Never chipper, never clinical. Use "you" / "your".

Profile:
${profileBrief(profile)}

Return:
- opener: one short sentence like "Here's what I've got."
- bullets: 2 to 5 short specific bullets that reflect back the most important facts. No generic filler. Include real names and times where known. Each bullet is a clause, not a full sentence.
- closer: one short sentence inviting confirmation, like "Sound right?"`,
    });
    return object;
  } catch (e) {
    console.log("[ai] summarizeOnboarding fallback:", e);
    const bullets: string[] = [];
    if (profile.name) bullets.push(`You go by ${profile.name}`);
    if (profile.household.length)
      bullets.push(
        `Household: ${profile.household.map((h) => h.name).join(", ")}`
      );
    if (profile.anchors.length)
      bullets.push(
        profile.anchors
          .map(
            (a) => `${a.title}${a.time ? ` at ${a.time}` : ""} ${a.days.join("/")}`
          )
          .join(" · ")
      );
    if (profile.work.mode !== "unspecified") bullets.push(`Work: ${profile.work.mode}`);
    return {
      opener: "Here's what I've got.",
      bullets: bullets.length ? bullets : ["Just the basics for now"],
      closer: "Sound right?",
    };
  }
}
