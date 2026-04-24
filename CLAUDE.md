# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

All commands run from the `expo/` directory using Bun.

```bash
# Install dependencies
bun i

# Start dev server (Rork tunnel, for Expo Go / Rork app)
bun run start

# Start with expo-dev-client (for custom dev builds)
bun run start:dev

# Web preview
bun run start-web

# EAS builds
bun run build:dev:ios         # internal dev build
bun run build:preview:ios     # internal TestFlight-style build
bun run build:production:ios  # App Store build

# Submit to App Store
bun run submit:ios

# Lint
bun run lint
```

## Architecture

The app is **Drift** — an AI-powered daily planner. It uses Expo Router (file-based routing) with React Native.

### File layout

```
expo/
├── app/              # Expo Router screens (file = route)
│   ├── (tabs)/       # Tab navigator: index (Today), drawer, settings
│   ├── add-task.tsx  # Modal: quick task entry
│   ├── onboarding.tsx
│   └── profile.tsx / profile-add.tsx
├── providers/        # React context + state (all use @nkzw/create-context-hook)
├── lib/              # Stateless helpers: AI calls, calendar, location, notifications
├── components/       # Shared UI components
├── constants/        # Colors, theme tokens
└── types/            # Shared TypeScript types (Task, UserProfile, etc.)
```

### State management

Five providers wrap the app in `_layout.tsx` (outer → inner): `SettingsProvider → ProfileProvider → TasksProvider → PlanProvider → ChatProvider`. All providers use `@nkzw/create-context-hook` and persist to AsyncStorage. React Query handles any server-fetched data.

### AI integration

`lib/ai.ts` calls Claude (Sonnet 4 / Haiku 4.5) through the Rork Toolkit proxy using the Vercel AI SDK (`ai` package + `createGateway`). The gateway base URL and secret key come from env vars:

- `EXPO_PUBLIC_TOOLKIT_URL` — Rork Toolkit backend
- `EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY` — auth key

Copy `.env.example` → `.env` and fill in values before running locally.

### EAS / App Store config

- Bundle ID: `io.day.drift`
- Expo owner: `brittm`
- EAS project ID placeholder in `app.json` → replace `YOUR_EAS_PROJECT_ID` after running `eas init`
- `eas.json` defines three profiles: `development` (internal), `preview` (internal), `production` (App Store)
- Submit config in `eas.json` needs `ascAppId` and `appleTeamId` filled in before first submit
