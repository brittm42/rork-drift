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
  - Tap = mark complete (check only, no strikethrough); chat posts a simple "Nice." follow-up.
  - Long-press = opens a 3-option action sheet: Missed / Skipped / Moved.
    - Missed → state set + chat asks about rescheduling.
    - Skipped → state set, no follow-up.
    - Moved → state set + calendar searched for a future event with the same title; chat acknowledges the move or falls back to the missed/reschedule prompt.
  - Long-press on an item already in a non-default state clears it (undo after a misclick).
  - Event states persist for today only (cleared on date rollover).
- [x] Plan tasks on Today mirror the same interaction model.
  - Tap = complete (check only, no strikethrough) + quick "Nice." follow-up.
  - Long-press = 4-option action sheet: Not today / Pick a different time today / Missed / No longer relevant.
    - Not today → removes from today's plan (back to drawer); protected tasks get a self-care-aware follow-up in chat.
    - Pick a different time today → chat follow-up for timing.
    - Missed → skipped state + chat offers to squeeze it in later.
    - No longer relevant → deletes the task.
  - Long-press on a skipped task clears it (undo).
- [x] Anchors remain read-only (no checkbox).

## Deferred

- [x] Post-completion follow-up for plan tasks (simple "Nice." acknowledgement).
- [ ] Long-press on drawer rows to edit classification inline.
- [ ] Protected aspirational enforcement — v1 pushes back in chat when a protected task is moved out of today; still TODO: auto-buffer tomorrow, detect repeated skip patterns, and open a larger conversation.
- [ ] Reactive-task inference from calendar event titles (e.g. dentist → "schedule 6mo follow-up").
- [ ] Self-care quota ("at least one most days") surfaced in the planner prompt and nudged if missing.
- [ ] Drive-time / "leave by" math.
- [ ] Pre-notification plan generation (needs backend).
- [ ] Recurring-item auto-detection from calendar history.
- [ ] Google Calendar write.
- [ ] Household birthday auto-nudge.
