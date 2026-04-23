# Build the memory layer + conversational onboarding foundation

## Why this first

Memory is the prerequisite for everything else you want — travel buffers, recurring reminders, the chat assistant, even better plan generation. Without it, each feature reinvents the same context. With it, every future feature gets smarter for free.

This batch focuses **only** on building that foundation. Chat, calendar write, and triggered reminders come next — each will be dramatically easier once memory exists.

## What you'll get

### A conversational onboarding that actually feels like talking

- Replaces the current form-style onboarding with a 3-phase chat flow
- **Phase 1 — Who are you** (~2 min): the assistant asks high-signal questions one at a time (name, household, hard daily anchors like school pickup, work situation) and reflects answers back for confirmation rather than asking you to re-type
- **Phase 2 — Permissions** (~2 min): only after the assistant summarizes what it learned ("here's what I've got about your life — does this sound right?"), then asks for calendar, notifications, and optional location, each with a plain-language why
- **Phase 3 — First task** (30 sec): one quick task so tomorrow's plan has something to work with
- Feels like texting an assistant, not filling out a form

### A real memory layer the AI uses on every call

A structured profile that lives in your database and is passed into every plan generation and task parse:

- **Household**: partner, kids (with ages/schedules), pets
- **Locations:** work, school, gym, grandma's house, etc.
- **Hard anchors**: recurring obligations with days/times (school pickup 3:30 M–F, therapy Thursdays, etc.)
- **Personal rules**: buffer times ("25 min from gym to school pickup"), energy patterns ("sharp mornings, afternoon dip")
- **Recurring life admin**: pet grooming cycles, annual vet, medication refills — stored but not yet surfaced as reminders (that's the next batch)
- **Work situation**: remote/hybrid/office, typical hours
- **Task durations:** Doesn't want to spend more than 20 minutes pulling weeds, dishes take 10 minutes.
- **Freeform notes**: a catch-all the assistant can append to as you use it

### A capability-tier home card (replaces any progress-percentage feeling)

Shown on Today as a dismissible "Unlock more" card:

- *"Add your key locations and I'll calculate travel time"*
- *"I can manage your refill schedule if you'd like."*

Each tier is a clear value trade, not a guilt metric. Tapping a card drops you into a quick 2-minute add flow for just that piece.

### A Profile screen you can edit anytime

- View everything the assistant knows about you, organized by section
- Edit or remove any item (household member, anchor, rule, recurring obligation)
- Add a freeform note ("I don't drink coffee after 2pm")
- Clear feedback that changes take effect on the next plan generation

### Smarter plan generation, immediately

Even before chat and calendar write ship, the morning plan will get noticeably better because the AI now sees your full profile — so pickup anchors, buffer rules, and energy patterns all flow into planning automatically.

## Design direction

- **Onboarding**: full-screen chat bubbles, the assistant on the left in a warm neutral tone, your replies on the right. Quick-tap chips for common answers (e.g. "Yes, that's right" / "Not quite") to keep typing minimal. Soft fade transitions between phases, no progress bar (it's a conversation, not a wizard).
- **Summary reveal moment**: when the assistant plays back what it learned at the end of Phase 1, use a gentle reveal animation — each bullet appearing in sequence. This is the "wow, it actually gets me" moment that earns the permission asks.
- **Capability card on Today**: horizontal, one small pill-card, unlock tip muted. Tap to expand. More information visible in expanded view. Tap again to provide more context to "unlock" more abilities. 
- **Profile screen**: clean list sections with subtle dividers, iOS-settings-feel but warmer. Each section has an "Add" affordance at the bottom.
- Tone across all copy: calm, confident, slightly warm. Never chipper. Never clinical.

## Screens in this batch

- **Onboarding (replaced)** — the three-phase conversational flow
- **Today (updated)** — adds the capability-tier card; existing plan view unchanged
- **Profile (new)** — view and edit everything the assistant remembers
- **Settings (updated)** — links to Profile; notification time stays here
- **Quick-add flows (new)** — small modal flows for adding a household member, an anchor, a rule, or a recurring obligation, triggered from the capability tiers card or Profile screen

## What's explicitly NOT in this batch (saved for next rounds)

- Conversational chat on Today ("clear 2 hours for the gym") — next batch, builds directly on this memory
- Calendar write via expo-calendar — next batch
- Travel-aware buffers using location — needs memory (locations) first, which this batch adds
- Triggered/recurring reminders actually firing — this batch stores the data; next batch surfaces them
- Different task types - projects, more detail in add task screen.
- Google OAuth — deferred; iOS native calendar will sync to Google automatically when we get to calendar write

## What I'd suggest doing in Claude Code in parallel (optional, no rush)

- Review the Supabase RLS policies for the new profile tables after this ships
- Set up a simple nightly job for recurring-obligation detection when we get to that batch
- Everything else stays in Rork — this batch is pure product iteration and you'll want hot reload

## Success feels like

You finish onboarding and genuinely think "huh, it actually got me." Tomorrow's plan shows up and respects your 3:30 pickup without you ever having typed those exact words into a task. That's the foundation the rest of the magic stacks on top of.