# Daily OS — consolidated iteration

Covers the new conversational chat on Today plus all prior feedback (onboarding tweaks, display fixes, location/Apple Maps, anchors, recurring vs. anchor clarity).

## Onboarding adjustments

- [x] Reword work question so unemployed / student / stay-at-home / caregiver feel seen
- [x] Provide a concrete example for the rules/energy question
- [x] Responsive follow-ups: if extraction returns nothing from a real reply, ask one clarifying question before advancing
- [x] Keep summary screen with "try again" affordance
- [x] Request Apple Calendar **write** permission during onboarding (with skip); offer again later through the CapabilityCard if skipped

## Today display

- [x] Rename CapabilityCard tier label from "Getting richer" to "Do more together"
- [x] Make the sub-text "Tell me more about you" instead of the first action item title
- [x] Remove the static, non-interactive "plan header" card — keep the header note as typography only; interactivity lives in the chat dock
- [x] All-day events stay at the top; timed events sorted chronologically
- [x] Blend Apple Calendar events with profile anchors in the same strip, chronologically
- [x] Lower / replace the + button — chat dock sits at the bottom and takes over task capture
- [x] Inbox keeps a + button for quick manual capture

## Conversational chat on Today

- [x] Persistent chat dock at the bottom of Today (replaces +), above tab bar
- [x] Warm greeting empty state using the user's name + one day-aware suggestion
- [x] Chat transcript scrolls above the dock when messages exist
- [x] Assistant can: add tasks, reshape day (soft = do it + undo; hard = propose), add anchor/recurring/rule, answer day questions, save durable memory, create Apple Calendar events on confirmation
- [x] Soft confirmation chips ("Saved: …", "Added to tomorrow morning") with Undo
- [x] Typing shimmer (three dots)
- [x] Messages retained 7 days, auto-trimmed; only today's turns sent to AI each turn
- [x] "Clear chat history" affordance in Settings
- [x] Durable memory layer surfaced in Profile as "What I know about you"

## Life Context / Profile

- [x] New "What I know about you" section listing saved memories, editable/deletable
- [x] Clearer distinction between Anchors (fixed day+time commitments) and Recurring items (things that repeat at a cadence, no specific time)
  - Rename "Recurring life admin" → "Recurring items" and add a one-line definition
  - Add one-line definition under "Hard anchors"

## Location & Apple Maps

- [x] Request Location permission when adding a location (expo-location)
- [x] Address search via Apple geocoder (`Location.geocodeAsync`) on submit; keep the label field intact
- [x] "Use current location" shortcut in the Add Location flow

## Recurring detection (calendar-aware suggestions)

- [ ] Background scan of recent calendar events to propose recurring items (e.g. haircut every 6 weeks) — deferred to a follow-up pass; scaffold the Suggestions slot on Today but leave detection TODO.

## Infra

- [x] New `ChatProvider` — messages + memories + mutations with tool-calling
- [x] AI `chatTurn` function with a structured action schema (add_task, save_memory, propose_reshape, do_reshape, add_anchor, add_recurring, add_rule, create_calendar_event, answer)
- [x] Apple Calendar write helper (`createCalendarEvent`) with graceful web fallback
- [x] Settings: `chat_last_cleared_at`, `calendar_write_enabled`
