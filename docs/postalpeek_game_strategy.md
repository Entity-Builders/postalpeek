# PostalPeek — Game Strategy
*Applied frameworks: MDA, Bartle Player Types, Flow Channel, Reward Systems*

---

## 1. What You've Already Built (Mechanics Inventory)

| Mechanic | Status | Notes |
|---|---|---|
| Flip gesture (drag/tap) | ✅ Built | GPU-driven, spring physics, 30° threshold |
| Rarity system | ✅ Built | `common → rare → epic → legendary` on [FeedItem](file:///Users/juano/projects/entity-builders/apps/PostalPeek/src/components/Postcard.tsx#14-51) |
| Claim system | ✅ Built | 10/day · 200/month limits via RPC |
| Daily Pack | ✅ Built | 1 pack/day, envelope reveal animation |
| Albums / Trips | ✅ Built | Multi-stop narrative arcs (AI-generated) |
| Hunt Mode | ✅ Built | Themed Hunt (7 categories) + Dynamic Hunt (Gemini) |
| Anon funnel | ✅ Built | Pinterest grid, blur at card 12, AuthCTA |
| Storytelling | ✅ Built | "Did you know" facts (5 types) on postcard back |
| Coupons | ✅ Built | Business discovery linked to postcard location |
| Vibe Metadata | ✅ Built | aesthetic_vibes, color_palette, scene_type, weather, etc. |
| Search | ✅ Built | Classic + Spotlight (AI intent parsing) |
| Bilingual | ✅ Built | ES / EN throughout |

**What's NOT built:** XP, progression goals, social layer, trading, leaderboards, notifications, meta-completion incentives.

---

## 2. MDA Analysis

```
MECHANICS  →  current state
──────────
• flip card           → reveals description + storytelling + StreetView photo
• claim               → moves postcard to collection
• open daily pack     → receive 3-5 curated postcards per day
• browse feed         → infinite scroll of AI-generated postcards
• hunt mode           → targeted generation by theme/subject/country

DYNAMICS  →  what emerges (intended vs actual)
──────────
INTENDED:  Daily ritual + collector progression + explorer curiosity
ACTUAL:    Claim 10 cards/day → collection grows → no goal → loop dies.
           The collector has nothing to complete toward.
           
AESTHETICS  →  target emotions
──────────
• WONDER:        discovering an obscure corner of the world
• NOSTALGIA:     the physical postcard metaphor, "stamp area", handwritten feel
• FOMO:          rarity system should trigger this — currently doesn't
• COMPLETIONISM: "I need all 5 stops of this album"
• SERENDIPITY:   finding a legendary card by accident
```

> **Core problem:** The core loop (browse → claim → collect) has no **meta-goal**. Players need something to collect *towards*, not just collect.

---

## 3. Bartle Player Type Gap Analysis

| Type | Motivation | What PostalPeek has | What's missing |
|---|---|---|---|
| **Achiever** | Goals, progress, milestones | Claim counter (daily/monthly) | **Country completion %, rarity completion, album finish badges** |
| **Explorer** | Discovery, secrets, lore | Hunt mode, Storytelling, Vibe metadata | **Hidden metadata reveal, "secret" location types, rare event cards** |
| **Socializer** | Community, sharing, gifting | — | **Send a postcard to a friend, "First claimed by" badge, shareable card link** |
| **Killer** | Competition, leaderboards | — | **Country leaderboard, rarity race, speed-hunters** |

Currently PostalPeek serves **Explorers only**. Achievers have no goals. Socializers and Killers are completely unserved.

> **Biggest opportunity: Achiever loop.** It's the simplest to build and has the highest retention impact.

---

## 4. Flow Channel Status

```
     Anxiety (challenge too high)
         ↑
   Hard  │                    ← 10 claims / day limit
         │         FLOW
Engaged  │    ░░░░░████████   ← anon blur at card 12 ← ✅ GOOD FRICTION
         │   ░░░░░░░░░░░░
   Easy  │░░░░░░░░░░░░░░   ← infinite feed, no goal, boredom zone ← ⚠️ PROBLEM
         └──────────────────→
           New user         Veteran user
```

- **New users:** Hit the blur wall at card 12 → great auth funnel, appropriate anxiety.
- **Veteran users (day 3+):** Collection grows, but toward nothing. Falls into **boredom zone**.
- **Fix:** Give veteran users an escalating challenge. Country completion, rarity hunts, timed events.

---

## 5. Reward System Audit

| Reward | Type | Schedule | Rating |
|---|---|---|---|
| Daily pack | Extrinsic | Fixed interval (24h) | ✅ Good retention hook |
| Claim postcard | Extrinsic | Player-triggered | ⚠️ No celebration moment |
| Rarity | Extrinsic | Variable ratio (random) | ❌ Not communicated — player doesn't know it's rare |
| Storytelling fact | Intrinsic | On flip | ✅ Good curiosity loop |
| Album complete | Intrinsic | Milestone | ❌ No finish state communicated to user |

> **Fix priority 1:** Make rarity visible and celebratory. A legendary card should feel like a Pokémon shiny — rare sound, glow animation, special reveal. Currently it's just a badge.

---

## 6. Proposed Strategy: 3 Phases

### Phase 1 — Strengthen the Core Loop (Now)
*Goal: Give the Achiever something to pursue.*

**A. Country Collection Map**
- Add a world map screen showing which countries the user has postcards from
- "X/195 countries" — biggest Achiever hook you can ship fast
- Data is already in the DB: `country` column on every postcard

**B. Rarity Celebration**
- When a legendary/epic card appears in the feed: subtle pulse animation, different card border
- When claimed: full-screen particle moment (like a gacha pull reveal)
- Show "🏆 First legendary from Argentina!" message

**C. Album Completion State**
- When all stops of a trip album are generated: show a "Complete Album" screen
- The album is already tracked (`status: 'completed'` in DB) — just needs a UI moment

**D. Claim Limit as Mechanic, not Friction**
- Reframe: "Your postbox holds 10 postcards/day — choose wisely"
- Add a visible counter `🏷 7 / 10 today` in the feed header
- When limit reached: animate a "full postbox" instead of a hard error

---

### Phase 2 — Social Layer (Next)
*Goal: Activate the Socializer (transforms users into growth vectors).*

**A. Send a Postcard**
- "Send to a friend" button on claimed cards → generates a shareable link with full postcard visual
- Recipient sees card front, can claim their own copy (with different rarity roll)
- This is the viral loop: a card literally travels between users

**B. "First Claimed By" Badge**
- On postcard back, show: `📮 First claimed by @username`
- Explorer reward: be the first to discover/claim a location

**C. City Leaderboard**
- "Top collectors in Buenos Aires" — weekly, resets Sunday
- Uses existing `city` + `owner_id` data

---

### Phase 3 — Monetization Layer (Later)
*Goal: Convert engaged users (~day 7+) into paying ones.*

**Free tier:** 10 claims/day, 1 daily pack, view feed
**Premium ("Collector's Pass"):**
- 30 claims/day
- 3 packs/day (different themes)
- Access to create custom Hunt targets
- Exclusive "Collector" badge on cards you discover first
- Early access to new vibes / styles

**One-time purchases:**
- "Theme pack": 10 postcards from a single city (e.g., "Tokyo Pack")
- "Legendary Pack": guaranteed 1 legendary + 4 epics
- "Album Builder": create a custom Trip album with AI-driven itinerary

---

## 7. Quick Wins (Implement This Week)

These use existing data — zero new backend work:

1. **`/map` route** — World map with dot for each country in the user's collection. Data: `SELECT DISTINCT country FROM postalpeek_postcards WHERE owner_id = $1`.
2. **Rarity animation** — CSS keyframe glow on legendary/epic cards in the feed. Already have `rarity` on [FeedItem](file:///Users/juano/projects/entity-builders/apps/PostalPeek/src/components/Postcard.tsx#14-51).
3. **Album done screen** — Detect `album.status === 'completed'` in `useAlbums` hook, show celebration UI.
4. **Claim counter in feed header** — `claimStatus.daily_used / claimStatus.daily_limit` already in [useClaimPostcard](file:///Users/juano/projects/entity-builders/apps/PostalPeek/src/hooks/useClaimPostcard.ts#23-126).
5. **Flip counter on card back** — "📮 Postcard from Buenos Aires, Argentina · Discovered via Hunt Mode" — all data already exists in `generation_metadata.strategy`.

---

## 8. The North Star Loop

```
DAILY RITUAL:
Open App → Collect Daily Pack → Browse Feed → Claim 3 Best Cards → Check World Map Progress

WEEKLY RITUAL:
Complete a themed Hunt → Finish an Album arc → Share rare find with a friend

LONG TERM:
Chase country completion → Race rarity leaderboard → Build legacy collection
```

The postcard is a cultural artifact. PostalPeek's unique edge is that every card is **one-of-a-kind AI art of a real place**. That's the WONDER lever. All of the above mechanics are designed to amplify that core feeling — not replace it.
