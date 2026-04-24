# Task types, Stuff Drawer, and checkable calendar events

## Task type system

- [x] Six task types on the `Task` model: `fixed_anchor`, `committed_block`, `floatable`, `energy_matched`, `reactive`, `aspirational` (plus `unclassified` until the AI or user decides).
- [x] Per-task fields: `energy_level` (deep/light), `is_self_care`, `cadence`, `parent_task_id`, `is_protected`, `window_start`/`window_end`, `needs_classification`, `pending_question`.
- [x] `parseTaskInput` (Haiku) classifies on capture, can return a single clarifying follow-up question instead of guessing.
- [x] Chat `add_task` action carries the classification; new `update_task` action lets the chat answer a follow-up and refine an existing task by title match.
- [x] Self-care count surfaced in the drawer header badge.

## Stuff Drawer (formerly Inbox)

- [x] Tab renamed "Drawer" with Archive icon; route file `app/(tabs)/drawer.tsx`.
- [x] Grouped, collapsible sections: "Needs a quick sort" first (shows pending_question inline), then the six task types, then Done (collapsed by default).
- [x] Each row shows meta chips: deep focus / low-lift, cadence, "for you" for self-care.
- [x] Urgency dot + urgent tag preserved.
- [x] FAB retained on Drawer only (Today captures via chat).

## Today screen

- [x] Calendar events are now checkable.
  - Tap = mark complete (strikethrough + check); the chat dock posts a follow-up prompt asking whether anything came out of the event.
  - Long-press = mark skipped (dashed bar + "skipped" tag, no prompt).
  - Tap again un-sets the state.
  - Event states persist for today only (cleared on date rollover).
- [x] Anchors remain read-only (no checkbox).

## Deferred

- [ ] Post-completion follow-up for plan tasks (currently only events trigger the follow-up prompt).
- [ ] Long-press on drawer rows to edit classification inline.
- [ ] Protected aspirational enforcement (planner respects `is_protected` → gentle pushback when skipped).
- [ ] Reactive-task inference from calendar event titles (e.g. dentist → "schedule 6mo follow-up").
- [ ] Self-care quota ("at least one most days") surfaced in the planner prompt and nudged if missing.
- [ ] Drive-time / "leave by" math.
- [ ] Pre-notification plan generation (needs backend).
- [ ] Recurring-item auto-detection from calendar history.
- [ ] Google Calendar write.
- [ ] Household birthday auto-nudge.
