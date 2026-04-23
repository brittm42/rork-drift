# Build Drift — a calm, calendar-aware daily planner

## Drift
Your day, already figured out. Drift reads your calendar, holds your task list, and writes your plan for you each morning — then adapts when life shifts.

## Features (v1)

**Plain-language task inbox**
- Tap a floating button from any screen to add a task by typing — no forms, no dropdowns.
- Drift quietly cleans up typos and notices urgency words like "today" or "ASAP."
- Tasks live in your inbox until you check them off. Nothing is ever lost.

**Calendar-aware morning plan**
- Each morning Drift reads your calendar and your inbox, then writes a prioritized plan of 3–7 tasks.
- Each task gets a one-line reason it's on today's list and a suggested time window ("before your 10am", "after lunch"), shown by default.
- A single header line captures the shape of your day ("Packed morning, open afternoon — front-load the focus work").

**Smart, adaptive notifications**
- A morning notification arrives anchored to your day: normally 7:00 AM, but earlier if your first meeting is early.
- Content adapts — a packed day reads differently than an open one.
- Gentle pre-meeting nudges and next-task reminders through the day.
- On empty days, a soft check-in suggests something productive if you've had a strong week, or something restful if the week was hard.
- Tapping any notification opens straight to Today.

**Re-route my day**
- A button on the Today view (and the action on mid-day notifications) asks Drift to rewrite the rest of your day from right now, around remaining meetings and what's already done.
- Always forward-looking — never dwells on what didn't happen.

**Additive progress**
- Check off tasks as you go. Progress is framed as "3 done" — no streaks, no scores, no guilt.
- Brief undo window after each tap. A calm celebration when the day is fully cleared.

**Calendar picker**
- During onboarding Drift asks permission to read your calendar and explains why.
- In settings you choose which calendars to include. Drift never writes to your calendar — ever.

**Onboarding**
- Welcome → choose notification time → grant calendar permission (with a clear why) → pick which calendars to include → add your first task → done.

**Settings**
- Change notification time, toggle calendars, manage account. Minimal by design.

## Design

- **Aesthetic:** off-white canvas with sage and deep forest accents. Warm, editorial, not clinical. Typography leads — task text is the hero, UI chrome recedes.
- **Calendar events** appear as lighter environmental context so your tasks stay foreground.
- **Motion:** a gentle "thinking" moment while the plan generates — feels considered, not loading. Soft check-off animations with subtle haptics.
- **Clear text labels** everywhere. Dynamic Type and VoiceOver supported from day one.
- **App icon:** off-white background with a soft sage leaf or a single curving line evoking a drift of wind — minimal, organic, calm.

## Screens

- **Today** — the hero. Day header, the plan with time windows under each task, progress count, re-route button.
- **Inbox** — every incomplete task, newest first, with the add button always within thumb reach.
- **Add task** — a bottom sheet with a single text field. Opens from anywhere.
- **Onboarding** — five short steps, no dead ends.
- **Settings** — notification time, calendar selector, account.

## Choices locked in

- Name: **Drift**
- Auth: email magic link (Google can come later)
- AI: Rork's built-in gateway with Claude Sonnet for planning and Haiku for task parsing
- Storage: on-device for v1 (data model mirrors the eventual cloud schema so sync can be added cleanly later)
- Notifications: local, adaptive, multi-touchpoint
- Re-routing: always user-triggered, surfaced prominently on Today and on mid-day notifications

## Explicitly out of scope for v1

Writing to your calendar, due-date pickers, recurring tasks, editing tasks after adding, weekly views, streaks or gamification, widgets, Dynamic Island, Siri.