import { z } from "zod";
import type { CalendarEventSnapshot, ChatAction, Task, UserProfile } from "@/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const SONNET = "claude-sonnet-4-5";
const HAIKU = "claude-haiku-4-5-20251001";

async function generateStructured<T>(params: {
  model: string;
  schema: z.ZodType<T>;
  prompt: string;
}): Promise<T> {
  const inputSchema = z.toJSONSchema(params.schema);
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 4096,
      tools: [{ name: "result", description: "Return the structured result", input_schema: inputSchema }],
      tool_choice: { type: "tool", name: "result" },
      messages: [{ role: "user", content: params.prompt }],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${text}`);
  }
  const data = await response.json();
  const toolUse = data.content?.find((b: { type: string }) => b.type === "tool_use");
  if (!toolUse) throw new Error("No structured response from model");
  return params.schema.parse(toolUse.input);
}

const taskParseSchema = z.object({
  title: z.string(),
  due_date: z.string().nullable().default(null),
  snooze_until: z.string().nullable().default(null),
  task_type: z
    .enum([
      "fixed_anchor",
      "committed_block",
      "floatable",
      "reactive",
      "aspirational",
      "project",
      "unclassified",
    ])
    .default("unclassified"),
  energy_level: z.enum(["deep", "light"]).nullable().default(null),
  is_self_care: z.boolean().default(false),
  cadence: z.string().nullable().default(null),
  clarifying_question: z.string().nullable().default(null),
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
      `Recurring items: ${profile.recurring_obligations
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
  if (profile.memories.length) {
    parts.push(
      `What I remember: ${profile.memories
        .slice(0, 25)
        .map((m) => m.text)
        .join(" | ")}`
    );
  }
  if (profile.notes.length) parts.push(`Notes: ${profile.notes.join(" | ")}`);
  return parts.length ? parts.join("\n") : "No profile yet.";
}

export async function parseTaskInput(raw: string, profile?: UserProfile, now?: Date): Promise<ParsedTask> {
  const today = (now ?? new Date()).toISOString().slice(0, 10);
  try {
    console.log("[ai] parseTaskInput:", raw);
    const object = await generateStructured({
      model: HAIKU,
      schema: taskParseSchema,
      prompt: `Clean up this task and classify it for a personal planning system. Fix typos, normalize capitalization, make it a clear action item. Keep it concise and preserve intent exactly — do not add scope.

Today's date: ${today}

Extract due_date (YYYY-MM-DD or null) — the hard deadline by which this task must be done. Signals: "today", "urgent", "ASAP", "now", "immediately", "by [date]", "this week", "end of week". Resolve relative terms using today's date. Null if no deadline is stated.

Extract snooze_until (YYYY-MM-DD or null) — when to start surfacing this task. Signals: "remind me tomorrow", "don't show until Monday", "check back next week". Null if no deferral is stated. Note: due_date = when it must be DONE; snooze_until = when to START showing it. Both can coexist.

Classify task_type as ONE of:
- fixed_anchor: non-negotiable, time-specific, recurring commitments (school pickup 3:30 M-F). Must have a clear fixed time and cadence.
- committed_block: scheduled with a time in mind, user holds themselves to it, but could shift if needed (deep work block M/W/F, single booked appointment). Has some concreteness but user is sole accountable party.
- floatable: needs to happen within a window but not at a specific time (order meds this week, follow up with recruiter, write performance review). Slot into open time. Use this for cognitively demanding tasks that have no fixed time — pair with energy_level: "deep".
- reactive: follow-up spawned by another task/event (schedule 6mo dentist after dentist).
- aspirational: wants-to-do, not committed (gym, reading, creative). No deadline, no fixed time.
- project: a bigger undertaking that requires a planning session and multiple downstream tasks to finish (backyard overhaul, cleaning out the basement, redoing the portfolio site). Different from aspirational — projects are work that needs decomposition, not just protected time. If the user's input sounds project-sized, use this and set clarifying_question to something like "Want to plan this out together?" so we can break it into steps.
- unclassified: truly ambiguous — use this if you aren't confident.

energy_level: "deep" if cognitively heavy (writing, hard conversations, strategic decisions), "light" if fine while depleted (admin, scheduling, errands), null if not obvious. Always set this when cognitive state is clear — do NOT use a separate task_type for energy, use this field instead.
is_self_care: true if this is self-care (gym, meditation, therapy, rest, walk, hobby time).
cadence: short phrase like "every 6 weeks" if a recurrence is stated, null otherwise.
clarifying_question: set ONE short question ONLY if you are genuinely unsure how to classify and the answer would materially change timing — e.g. "Is this a hard deadline or something you want to get to this week?". Null if confident. Never ask for trivia.

User context (for disambiguation only — do NOT expand the task):
${profileBrief(profile)}

Input: ${JSON.stringify(raw)}`,
    });
    return object;
  } catch (e) {
    console.log("[ai] parseTaskInput failed, falling back to raw:", e);
    return {
      title: raw.trim(),
      due_date: null,
      snooze_until: null,
      task_type: "unclassified" as const,
      energy_level: null,
      is_self_care: false,
      cadence: null,
      clarifying_question: null,
    };
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
        start_time: z.string().nullable(),
      })
    )
,
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
    intent?: string;
  };
};

export async function generateDailyPlan(input: PlanInput): Promise<GeneratedPlan> {
  const { tasks, events, now, reroute, profile } = input;
  const todayStr = now.toISOString().slice(0, 10);
  const incompleteTasks = tasks
    .filter((t) => !t.is_complete)
    .filter((t) => !t.snooze_until || t.snooze_until <= todayStr)
    .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, snooze_until: t.snooze_until }));

  const baseInstructions = `You are a calm, competent daily planner acting as this person's personal chief of staff. Your tone is quiet, confident, forward-looking, never shaming. You respect their life, not just their tasks.

About the person:
${profileBrief(profile)}

Tasks available:
${JSON.stringify(incompleteTasks, null, 2)}

Calendar events today:
${JSON.stringify(events, null, 2)}

Current time: ${now.toISOString()}
Today's date: ${todayStr}

Prioritization rules — apply in order:
1. snooze_until = today AND due_date = today → highest urgency (task was deferred to its deadline day). Prioritize above all else.
2. due_date = today → top priority. Prioritize strongly; include if at all possible.
3. due_date within 3 days → high priority. Include unless there is truly no time.
4. due_date > 3 days → normal priority. Schedule where it fits best.
5. due_date = null → surface based on task type. aspirational and project tasks only if there is genuine slack.

Generate a prioritized plan for today:
- Select 3 to 7 tasks (fewer if there are fewer tasks)
- Every task_id MUST come from the Tasks list above — never invent ids
- Never place tasks during calendar event blocks
- Respect hard anchors from the profile (e.g. school pickup): leave buffer time and never schedule conflicting work
- Honor personal rules and energy patterns when ordering the day
- Suggest a natural time window for each task (e.g. "Before your 10am", "After lunch", "Mid-afternoon", "Early evening") — use anchor-relative phrasing when appropriate ("Before pickup", "After drop-off")
- ALWAYS include a concrete start_time for each task in 24-hour HH:MM format (e.g. "09:30", "14:00") — this is required so the UI can place tasks chronologically alongside events and anchors. If a task is genuinely flexible, pick a reasonable slot that fits around calendar events and anchors. Never return null unless there is literally no time that could work today.
- Write a one-line rationale for why each task is on today's plan — warm, specific, reference their life where natural, never generic
- Write a one-line "shape of the day" header (e.g. "Packed morning, open afternoon — front-load the focus work")`;

  const rerouteInstructions = reroute
    ? `\n\nThe user is re-routing mid-day. Current time: ${now.toISOString()}.
Tasks already completed today: ${JSON.stringify(reroute.completedToday)}
Remaining calendar events: ${JSON.stringify(reroute.remainingEvents)}${reroute.intent ? `\nUser intent: ${reroute.intent}` : ""}
Reason forward only — acknowledge what's left, never dwell on what didn't happen.`
    : "";

  console.log(
    "[ai] generateDailyPlan tasks=%d events=%d reroute=%s profile=%s",
    incompleteTasks.length,
    events.length,
    !!reroute,
    profile ? "yes" : "no"
  );

  const object = await generateStructured({
    model: SONNET,
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
    const object = await generateStructured({
      model: HAIKU,
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
      mode: z.enum([
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
        "unspecified",
      ]),
      typical_hours: z.string().nullable(),
    })
    .nullable(),
  rules: z.array(z.string()),
  energy_pattern: z.string().nullable(),
  notes: z.array(z.string()),
  follow_up_question: z.string().nullable(),
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
    follow_up_question: null,
  };
  try {
    const object = await generateStructured({
      model: HAIKU,
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
- work: mode from remote/hybrid/office/flexible/student/caregiver/stay_at_home/unemployed/retired/other/unspecified. Use student for students, caregiver for full-time caregiving, stay_at_home for stay-at-home parents, retired for retirees, unemployed if between jobs. typical_hours like "9-5" if stated.
- rules: short imperative strings like "25 min buffer from gym to school", "no meetings after 4pm".
- energy_pattern: short phrase if stated ("sharp mornings, afternoon dip").
- notes: catch-all for useful context that doesn't fit the above.
- follow_up_question: ONLY set if the user gave a real answer but it was ambiguous or incomplete enough that one short clarifying question would materially improve the extraction. Example: user says "just my husband and the dog" on household → null (fine). User says "kids" → "How many kids, and roughly what ages?". User says "it's complicated" on work → "In a sentence, what fills most of your days right now?". Keep it to one sentence, warm, never prying. If the reply was skip/none/clear, leave null.`,
    });
    return object;
  } catch (e) {
    console.log("[ai] extractOnboardingFacts failed:", e);
    return empty;
  }
}

const summarySchema = z.object({
  opener: z.string(),
  bullets: z.array(z.string()),
  closer: z.string(),
});

export type OnboardingSummary = z.infer<typeof summarySchema>;

export async function summarizeOnboarding(profile: UserProfile): Promise<OnboardingSummary> {
  try {
    const object = await generateStructured({
      model: HAIKU,
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
      bullets.push(`Household: ${profile.household.map((h) => h.name).join(", ")}`);
    if (profile.anchors.length)
      bullets.push(
        profile.anchors
          .map((a) => `${a.title}${a.time ? ` at ${a.time}` : ""} ${a.days.join("/")}`)
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

// ---- Conversational chat on Today ------------------------------------------

const chatActionSchema = z.object({
  kind: z.enum([
    "answer",
    "add_task",
    "update_task",
    "save_memory",
    "add_anchor",
    "add_recurring",
    "add_rule",
    "add_household",
    "add_location",
    "do_reshape",
    "propose_reshape",
    "create_calendar_event",
  ]),
  confirmation: z.string().optional(),
  raw: z.string().optional(),
  due_date: z.string().nullable().optional(),
  snooze_until: z.string().nullable().optional(),
  task_type: z
    .enum([
      "fixed_anchor",
      "committed_block",
      "floatable",
      "reactive",
      "aspirational",
      "project",
      "unclassified",
    ])
    .optional(),
  energy_level: z.enum(["deep", "light"]).nullable().optional(),
  is_self_care: z.boolean().optional(),
  cadence: z.string().nullable().optional(),
  task_title_match: z.string().optional(),
  text: z.string().optional(),
  category: z
    .enum(["preference", "fact", "routine", "health", "relationship", "other"])
    .optional(),
  title: z.string().optional(),
  time: z.string().nullable().optional(),
  days: z.array(WEEKDAYS).optional(),
  buffer_minutes: z.number().nullable().optional(),
  name: z.string().optional(),
  relation: z.enum(["partner", "child", "pet", "other"]).optional(),
  detail: z.string().nullable().optional(),
  label: z.string().optional(),
  address: z.string().nullable().optional(),
  summary: z.string().optional(),
  details: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

const chatResponseSchema = z.object({
  message: z.string(),
  actions: z.array(chatActionSchema),
});

export type ChatResponse = { message: string; actions: ChatAction[] };

export async function chatTurn(params: {
  userMessage: string;
  recentTurns: { from: "user" | "bot"; text: string }[];
  profile: UserProfile;
  tasks: Task[];
  events: CalendarEventSnapshot[];
  planHeader: string | null;
  now: Date;
  canWriteCalendar: boolean;
}): Promise<ChatResponse> {
  const {
    userMessage,
    recentTurns,
    profile,
    tasks,
    events,
    planHeader,
    now,
    canWriteCalendar,
  } = params;

  const incompleteTasks = tasks
    .filter((t) => !t.is_complete)
    .slice(0, 20)
    .map((t) => ({ title: t.title, due_date: t.due_date ?? null, snooze_until: t.snooze_until ?? null }));

  const transcript = recentTurns
    .slice(-10)
    .map((t) => `${t.from === "user" ? "User" : "You"}: ${t.text}`)
    .join("\n");

  try {
    console.log("[ai] chatTurn: calling generateStructured");
    const object = await generateStructured({
      model: SONNET,
      schema: chatResponseSchema,
      prompt: `You are Drift — a calm, warm, slightly personal chief-of-staff for ${profile.name ?? "the user"}. You already know them; act like it. Use their name occasionally. Never chipper, never clinical. Reply in 1–2 short sentences unless a question genuinely needs more.

Current time: ${now.toISOString()}
Today's plan header: ${planHeader ? JSON.stringify(planHeader) : "(no plan yet)"}
Today's remaining tasks: ${JSON.stringify(incompleteTasks)}
Today's calendar: ${JSON.stringify(events)}
Can create calendar events: ${canWriteCalendar}

What I know about them:
${profileBrief(profile)}

Recent conversation:
${transcript || "(just getting started today)"}

User just said: ${JSON.stringify(userMessage)}

Your job is to produce:
1) A short conversational "message" reply.
2) An "actions" array — structured things to do. One message can trigger multiple actions (e.g. answer + save_memory). Keep action count small.

Action rules:
- add_task: for any task capture. due_date is a YYYY-MM-DD hard deadline or null — resolve natural language using current time ("today" → ${now.toISOString().slice(0, 10)}, "tomorrow" → next day, "by Friday" → next Friday, etc.). snooze_until is a YYYY-MM-DD date to start surfacing the task, or null — use when user says "remind me Friday", "don't show until next week", etc. ALSO classify task_type and fill the other fields (energy_level, is_self_care, cadence) using the same definitions as the task parser: fixed_anchor | committed_block | floatable | reactive | aspirational | project | unclassified. For cognitively heavy tasks with no fixed time, use floatable + energy_level: "deep". If you're not sure, use unclassified and append ONE short follow-up question to the end of your message instead of inventing a classification. "confirmation" is a short chip label like "Added — due Friday".
- update_task: use when the user answers a classification follow-up about a recently added task. task_title_match should be a distinctive substring of that task's title so the app can find it. Only set the fields the user actually clarified; leave the rest null.
- save_memory: for durable facts about the person's life ("I got a dog that needs grooming every 4 weeks", "my home is in Austin"). DO NOT save one-off tasks as memories. "confirmation" chip like "Saved: dog grooming every 4 weeks".
- add_anchor: ONLY for fixed-day-and-time commitments ("school pickup 3:30 M-F"). Not for vague "I try to work out mornings".
- add_recurring: for cadence-based items without a specific time ("dog grooming every 4 weeks", "haircut every 6 weeks"). cadence is a short phrase.
- add_rule: for planning constraints ("no meetings after 4pm", "25 min buffer to school pickup").
- add_household / add_location: when the user introduces new people/pets or places.
- do_reshape: use for soft shuffles the user asks for ("clear 2 hours this afternoon for the gym") that don't touch a hard anchor. The "summary" is what you're doing. Triggers an automatic reroute.
- propose_reshape: use when the request would move a hard anchor or create a calendar event and needs confirmation first. Include a plain-language details field.
- create_calendar_event: only when Can create calendar events is true AND the user explicitly wants an event on their calendar, or accepted a propose_reshape. start_time and end_time must be full ISO strings based on current time.
- answer: default fallback when no action is needed.

Hard rules:
- Never invent facts. If the user asked something and you don't know, say so briefly.
- Never say you "saved" something unless you emitted the action for it.
- Keep message calm and forward-looking. No emojis.
- If user is vague ("plan me a better afternoon"), do a do_reshape with a concrete summary of what you'll try.`,
    });
    console.log("[ai] chatTurn: got response");
    return object as unknown as ChatResponse;
  } catch (e) {
    console.log("[ai] chatTurn failed:", e);
    return {
      message:
        "I hit a snag just now — can you try that again in a moment?",
      actions: [],
    };
  }
}

export function actionId(a: ChatAction, idx: number): string {
  return `${a.kind}_${idx}`;
}
