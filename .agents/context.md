---
description: PostalPeek project context, branding, narrative identity, and Entity Builders universe integration
---

# PostalPeek — Project Context

## 1. IDENTITY & NARRATIVE HIERARCHY

PostalPeek follows a **cinematic branding hierarchy**:

```
Entity Builders (the studio)
  └── Kyle Walker (digital agent)
       └── PostalPeek (his creation — a watercolor postcard collection)
```

### Entity Builders
- The **parent brand / studio** that creates digital agents
- Appears in onboarding as "Entity Builders presents"
- Appears in footer as "Powered by Entity Builders"
- The umbrella brand across all apps in the monorepo

### Kyle Walker
- **Full name:** Kyle Walker
- **Role:** Digital Agent · Photographer · Watercolor Artist
- **Personality:** Mysterious, poetic, always moving. Speaks in first person.
- **Voice examples:**
  - "I travel the world and paint what I see."
  - "Every street, every café, every hidden corner becomes a watercolor postcard."
  - "These postcards are for you."
  - "Walker never stops walking."
- **Relationship to PostalPeek:** He IS PostalPeek. The app is his personal postcard collection shared with the world.

### PostalPeek
- **What it is:** A curated feed of AI-generated watercolor postcards from real locations worldwide
- **Tone:** Warm, analog, travel-journal aesthetic
- **Not:** A generic gallery app. It's Walker's personal world.

## 2. BRANDING RULES

1. **Walker speaks in first person** — never describe him in third person in user-facing copy
2. **Entity Builders is the studio credit** — like "A Marvel Studios Production", not the protagonist
3. **PostalPeek is the app name** — appears in URL, meta tags, page titles, but NOT as the narrator
4. **The postmark stamp** uses "PostalPeek" — it's the app's subtle signature, like a watermark

## 3. UX PATTERNS

### First Visit (Onboarding)
- Full-screen Walker Welcome slide as first carousel item
- Shows stacked postcards from the real feed + Walker's introduction
- Controlled by `localStorage('postalpeek_welcomed')` — shows once per device
- Country filters hidden during onboarding
- Copy: "Entity Builders presents → Kyle Walker → Digital Agent · Photographer · Watercolor Artist"

### Auth Gate (Content Wall)
- Triggers after 5 free postcards for unauthenticated users
- **Concept 3 (Hero Postal + Bottom Sheet):** Dark fullscreen with hero postcard from feed, ambient glow, stacked cards, Walker narrative, white bottom sheet with login/register form
- Copy: "Walker never stops walking. Create an account to follow the journey."

### Admin Access
- Secret triple-click on footer to reveal admin login
- Admin detection via `useAuth` hook (hardcoded email list)
- Green dot indicator next to "Entity Builders" in footer when admin is logged in
- Video generation button only visible to admins

## 4. TECH STACK

- **Framework:** Vite + React (web-only, not React Native despite Expo imports)
- **Carousel:** Embla Carousel (vertical scroll, snap to card)
- **Auth:** Supabase Auth (email/password)
- **Database:** Supabase Postgres (`postalpeek_postcards` table)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Video Generation:** Imagine.art API via Supabase Edge Functions
- **Fonts:** Serif (Playfair Display style), handwriting for postcard captions

## 5. COLOR PALETTE

- **Background:** `#e6e2da` (warm cream/beige)
- **Auth Gate Background:** `#0a0a12` (deep dark)
- **Text Primary:** `stone-800`
- **Text Secondary:** `stone-500`
- **Text Muted:** `stone-400` with opacity variants
- **Accent:** `indigo-600` (buttons, focus rings)
- **Card Frame:** White with subtle shadow

## 6. KEY FILES

```
apps/PostalPeek/
├── src/
│   ├── App.tsx                          # Root app with auth, admin modal
│   ├── index.css                        # Global styles, animations
│   ├── components/
│   │   ├── WalkerFeed.tsx               # Main feed carousel
│   │   ├── WalkerWelcome.tsx            # First-visit onboarding slide
│   │   ├── Postcard.tsx                 # Individual postcard component
│   │   ├── AuthGateModal.tsx            # Content gate (login/register)
│   │   ├── AdminLoginModal.tsx          # Secret admin login
│   │   ├── WalkerFilterMenu.tsx         # Country filter bar
│   │   └── WalkerFeedStates.tsx         # Loading/empty states
│   └── utils/
│       └── welcomeStorage.ts            # localStorage helpers for onboarding
```
