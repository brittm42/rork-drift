# Today-screen overhaul, auto-planning, Apple Maps search, and profile polish

## Today screen

- [x] Auto-plan safety net: if today's plan is missing on open, generate quietly (no duplicate notification).
- [x] Pre-notification generation is still deferred until backend is available — documented for user.
- [x] "Re-route my day" button removed. Chat handles all mid-day adjustments.
- [x] Plan sticks once generated. Chat `do_reshape` is promoted to a confirm-required proposal — never auto re-routes without user acceptance.
- [x] True chronological "On your plate today":
  - All-day calendar items grouped at the top.
  - Events, plan tasks, and anchors merged chronologically.
  - Tasks show checkbox; anchors show "anchor" tag; calendar events show "event" tag.
- [x] Plan header line ("Happy birthday…" style) removed below the Do More Together card.
- [x] Collapsible "Do more together" card. Default collapsed; tap to expand. Stable 3-suggestion sample per app session (no mid-session rotation).
- [x] ChatDock fully opaque background (solid fill + top divider).
- [x] Task capture happens via chat — no separate + FAB on Today.

## Profile

- [x] Bigger section headers across the page.
- [x] "You" section: Name, Work/days, Energy patterns, Personal tendencies (subsection absorbing Rules).
- [x] Anchors kept, with one-line description clarifying vs. Recurring items.
- [x] Household member edit flow with birthday (month + day) support.

## Locations / Apple MapKit JS

- [x] `lib/mapkit.ts` — token exchange + `searchPlaces` using `https://maps-api.apple.com`.
- [x] Location editor shows search-by-name results list with address/category; tap to pin.
- [x] "Use current location" still works.
- [x] Label field preserved.
- [x] Settings includes MapKit JS token input (paste JWT) + disconnect.

## Settings

- [x] "Include Calendars" → "Read from".
- [x] 12-hour / 24-hour toggle (default 12h). All times in the app reflect it.
- [x] Morning time picker uses chosen format.
- [x] Apple Maps section with token input.

## Calendar

- [x] Read behavior unchanged.
- [x] Anchors + calendar events + plan tasks feed the unified chronological list.

## Deferred

- [ ] Drive-time / "leave by" math (needs MapKit token in hand + Directions API wiring).
- [ ] Pre-notification plan generation (needs backend/background task).
- [ ] Recurring-item auto-detection from calendar history.
- [ ] Google Calendar write.
- [ ] Household birthday → automatic "in 2 weeks" chat nudge (data captured; surfacing logic pending).
