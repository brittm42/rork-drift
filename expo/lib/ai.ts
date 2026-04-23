import { createGateway, generateObject } from "ai";
import { z } from "zod";
import type { CalendarEventSnapshot, Task } from "@/types";

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

export async function parseTaskInput(raw: string): Promise<ParsedTask> {
  try {
    console.log("[ai] parseTaskInput:", raw);
    const { object } = await generateObject({
      model: gateway(HAIKU),
      schema: taskParseSchema,
      prompt: `Clean up this task for a personal to-do list. Fix typos, normalize capitalization, make it a clear action item. Keep it concise and preserve intent exactly — do not add scope. Extract urgency (true/false) — urgency signals include: "today", "urgent", "ASAP", "now", "by [date/time]", "immediately".\n\nInput: ${JSON.stringify(raw)}`,
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
  reroute?: {
    completedToday: string[];
    remainingEvents: CalendarEventSnapshot[];
  };
};

export async function generateDailyPlan(input: PlanInput): Promise<GeneratedPlan> {
  const { tasks, events, now, reroute } = input;
  const incompleteTasks = tasks
    .filter((t) => !t.is_complete)
    .map((t) => ({ id: t.id, title: t.title, urgency_flag: t.urgency_flag }));

  const baseInstructions = `You are a calm, competent daily planner. Your tone is quiet, confident, forward-looking, never shaming.

Tasks available:
${JSON.stringify(incompleteTasks, null, 2)}

Calendar events today:
${JSON.stringify(events, null, 2)}

Current time: ${now.toISOString()}

Generate a prioritized plan for today:
- Select 3 to 7 tasks (fewer if there are fewer tasks)
- Every task_id MUST come from the Tasks list above — never invent ids
- Never place tasks during calendar event blocks
- Suggest a natural time window for each task (e.g. "Before your 10am", "After lunch", "Mid-afternoon", "Early evening")
- Write a one-line rationale for why each task is on today's plan — warm, specific, never generic
- Write a one-line "shape of the day" header (e.g. "Packed morning, open afternoon — front-load the focus work")`;

  const rerouteInstructions = reroute
    ? `\n\nThe user is re-routing mid-day. Current time: ${now.toISOString()}.
Tasks already completed today: ${JSON.stringify(reroute.completedToday)}
Remaining calendar events: ${JSON.stringify(reroute.remainingEvents)}
Reason forward only — acknowledge what's left, never dwell on what didn't happen.`
    : "";

  console.log("[ai] generateDailyPlan tasks=%d events=%d reroute=%s", incompleteTasks.length, events.length, !!reroute);

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
