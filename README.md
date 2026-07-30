# Chatline — Customer Support Chat Assessment (Free / GitHub-hosted)

A web app for testing customer-support chat applicants. Two sections: a
**typing test** (live WPM / accuracy) and a **15-minute multi-chat
simulation** where several customers arrive over time with different moods and
urgency. Each candidate gets **one attempt**, enforced in Firestore rules.

This is the **fully free** build: everything runs on GitHub Pages plus
Firebase's free **Spark plan** (no credit card, no Cloud Functions, no
per-token API costs).

- **Frontend:** React + TypeScript + Vite + Tailwind + React Router
- **Backend:** Firebase Auth (Google) + Firestore — free Spark plan
- **Hosting:** GitHub Pages (via GitHub Actions)

---

## What "free" changed

The paid version used a Cloud Function to call an LLM for two things: driving
customers dynamically, and grading written answers. Cloud Functions require
Firebase's Blaze (pay-as-you-go) plan, and the LLM itself bills per token.
Neither fits a zero-cost, static-only requirement, so both were replaced with
client-side logic:

| Feature | Paid (LLM) version | This free version |
|---|---|---|
| Customer replies | Fully dynamic, generated live | **Branching state machine** — scripted beats chosen by what the candidate types |
| Scoring | LLM judges quality | **Deterministic rules** over the transcript + measured timings |
| Cost | Blaze plan + API tokens | **$0**, Spark plan |
| Memorizable? | No | Somewhat — see note below |

**Trade-off, stated plainly:** the branching customers react to signals in the
candidate's messages (did they greet, apologize, ask for an order number,
respect the refund policy, etc.), so they're not a fixed tape — but a
determined applicant could eventually learn the patterns. The rule-based
scorer measures structure and correctness, not nuance or genuine empathy. For
volume screening this is solid; for final-round judgment, a human should still
read the transcripts (they're all stored and shown in the admin view). If you
later move to a paid plan, only two files need swapping back
(`src/lib/personas.ts` and `src/lib/scoring.ts`) plus re-adding the function.

---

## How the simulation works

Customers live in `src/lib/personas.ts`. Each has:

- an **opening message** and a **join time** (Customer D joins at 7 min);
- an ordered list of **beats** — each beat has a `match(signals, state)` test
  and a line to say; the first matching beat fires;
- an **impatient line** used if the candidate ignores them too long;
- distinct personality, urgency, and writing style.

`detectSignals()` scans each candidate reply for greetings, apologies,
requests for identifying info, refund-policy mentions, empathy, closings, and
length. Those signals drive branching. The timed **supervisor announcement**
(refunds over $100 need approval) fires at 5 minutes and stays visible; the
double-charge customer will push back if the candidate promises an instant
refund without acknowledging the policy — a deliberate accuracy trap.

## How scoring works

`src/lib/scoring.ts` computes the six categories (total 100):

| Category | Max | How it's measured |
|---|---|---|
| Response time | 20 | Average measured reply latency (≤15s full marks, ≥120s zero) |
| Grammar | 10 | Capitalization, end punctuation, sensible length, no double spaces |
| Professional tone | 15 | Greeting, empathy, apology, closing, no all-caps |
| Accuracy | 20 | Asked for identifier; handled the refund policy correctly |
| Conversation management | 20 | Engaged every customer; drove chats to resolution |
| Prioritization | 15 | Reached high-priority customers before low-priority ones |

Pass thresholds (editable in `src/lib/config.ts`): 45 WPM, 95% typing
accuracy, 70/100 overall. The `aiFeedback` field holds rule-generated
commentary (the name is kept so the data model and dashboards are unchanged).

---

## Project structure

```
.
├─ .github/workflows/deploy.yml   GitHub Pages CI/CD
├─ public/404.html                SPA fallback (app also uses hash routing)
├─ src/
│  ├─ components/                 TypingTest, ChatSim, ScoreReport, ui atoms
│  ├─ hooks/                      useAuth, useSimulation, useDarkMode
│  ├─ lib/                        firebase, config, scoring, data, personas, types
│  ├─ pages/                      Landing, Assessment, Candidate/Admin dashboards
│  ├─ App.tsx  main.tsx
│  └─ styles/index.css
├─ firestore.rules                Security rules (isolation + one-attempt)
├─ firebase.json  .firebaserc
├─ .env.example                   Frontend env vars
└─ vite.config.ts
```

---

## Setup

### 1. Firebase project (free Spark plan — no card)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method →** enable **Google**.
3. **Firestore Database →** create a database (production mode).
4. **Project settings → General → Your apps →** add a **Web app** and copy the
   config values.

You do **not** need to upgrade to Blaze. No functions are used.

### 2. Configure the app

```bash
cp .env.example .env
# paste your Firebase web config values into .env
```

Set the admin email(s) in **two** places (they must match):

- `src/lib/config.ts` → `ADMIN_EMAILS`
- `firestore.rules` → `isAdmin()`

### 3. Deploy Firestore rules

Either paste `firestore.rules` into the console (**Firestore → Rules**), or:

```bash
npm install -g firebase-tools
firebase login
# set your project id in .firebaserc first
firebase deploy --only firestore:rules
```

### 4. Run locally

```bash
npm install
npm run dev
```

---

## Deploying to GitHub Pages

### Option A — GitHub Actions (recommended)

1. Push this repo to GitHub.
2. **Settings → Pages → Source:** GitHub Actions.
3. **Settings → Secrets and variables → Actions → Secrets:** add
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
4. **Variables** tab: add `VITE_BASE` = `/<your-repo-name>/`.
5. Push to `main`. It builds and publishes automatically.

### Option B — Manual

```bash
# set VITE_BASE to /<repo-name>/ in .env first
npm run deploy   # builds and pushes dist/ to the gh-pages branch
```

### Firebase authorized domains

In **Authentication → Settings → Authorized domains**, add your GitHub Pages
host (e.g. `your-user.github.io`) so Google sign-in works on the live site.

> The app uses **hash routing** (`/#/assessment`) so GitHub Pages deep links
> never 404. `public/404.html` is an extra safety net.

---

## Environment variables

| Variable | Secret? | Purpose |
|---|---|---|
| `VITE_FIREBASE_*` | No | Firebase web config (safe to expose) |
| `VITE_BASE` | No | GitHub Pages base path |

There are no server secrets in this build.

---

## One-attempt guarantee

- Starting the assessment creates `/attempts/{uid}`. Rules allow `create` only
  when no doc exists for that uid, and `update` only while status is
  `in_progress`. A `completed` attempt can never be reopened by the candidate.
- Results live at `/results/{uid}`, written once and immutable to the
  candidate.
- Because it's enforced in **Firestore rules**, clearing browser storage or
  hitting the URL directly cannot grant a second attempt.
- Admins can delete a submission, which also frees the attempt (re-invite).

---

## Admin vs candidate

- **Candidate:** Google sign-in, take the assessment once, view only their own
  result.
- **Admin** (email in the config list): dashboard with totals, averages, pass
  rate, leaderboard chart, search/sort, per-candidate detail, CSV export, and
  delete.

---

## Free-tier limits (Spark plan)

Firestore free tier is 50K reads / 20K writes / 20K deletes per day and 1 GiB
stored. This app writes a few documents per candidate and the admin view reads
all results; you'd need thousands of candidates per day to approach the limits.
Google sign-in has no practical cap for this use.
