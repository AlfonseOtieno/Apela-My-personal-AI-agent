# Apela — Personal AI Agent
### Phase 1: Interface + Habit Tracker

A professional digital secretary. One continuous chat. Everything remembered.

- **Chat (PWA)** → WhatsApp-style interface at `/chat`
- **Dashboard (Web)** → Statistics, patterns, reports at `/dashboard`
- **AI Brain** → Gemini 1.5 Flash
- **Database** → Supabase (free tier)
- **Hosting** → Vercel (free tier)

---

## Step-by-step setup

### Step 1 — Clone the repo and install dependencies

```bash
git clone https://github.com/AlfonseOtieno/Apela-My-personal-AI-agent.git
cd Apela-My-personal-AI-agent
npm install
```

---

### Step 2 — Set up Supabase (the database)

1. Go to **[supabase.com](https://supabase.com)** → Sign in → New project
2. Give it a name (e.g. `apela`) and set a database password → Create project
3. Once created, go to **SQL Editor** (left sidebar)
4. Click **New query**, paste the entire contents of `supabase-schema.sql`, click **Run**
5. Go to **Project Settings → API** (left sidebar)
6. Copy these three values — you'll need them in Step 4:
   - **Project URL** → e.g. `https://abcxyz.supabase.co`
   - **anon public** key → long string starting with `eyJ...`
   - **service_role** key → another long string (keep this secret)

---

### Step 3 — Get your Gemini API key

1. Go to **[aistudio.google.com](https://aistudio.google.com)**
2. Sign in with your Google account
3. Click **Get API key** → **Create API key in new project**
4. Copy the key (starts with `AIza...`)

---

### Step 4 — Push to GitHub

Make sure your code is in the repo:

```bash
git add .
git commit -m "Phase 1 — interface and habit tracker"
git push origin main
```

---

### Step 5 — Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** → Sign in with GitHub
2. Click **Add New Project**
3. Import `Apela-My-personal-AI-agent` from your GitHub
4. Before clicking Deploy, click **Environment Variables** and add these 4 variables:

| Variable name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
| `GEMINI_API_KEY` | Your Gemini API key |

5. Click **Deploy** — takes about 2 minutes
6. You'll get a URL like `https://apela-my-personal-ai-agent.vercel.app`

---

### Step 6 — Install the PWA

**On Android (Chrome):**
1. Open your Vercel URL in Chrome
2. Tap the **⋮ menu** → **Add to Home Screen** → Install
3. The app opens directly to the chat interface

**On iOS (Safari):**
1. Open your Vercel URL in Safari
2. Tap the **Share button** (box with arrow)
3. Tap **Add to Home Screen** → Add
4. The app opens to the chat interface

**On Desktop (Chrome/Edge):**
1. Open your Vercel URL
2. Click the **install icon** in the address bar (right side)
3. Click Install

---

## How to use Apela

### Logging habits (in the chat)

Just tell it what you did:
- `"I did my workout for 45 minutes, felt great"`
- `"Read 30 pages this morning"`
- `"Ran 5km, feeling sore"`
- `"Boxing session — 1 hour, felt energized"`

Apela replies with a short confirmation and logs it to your database.

### Checking your stats (in the chat)

- `"How consistent have I been with workouts this week?"`
- `"Show me my reading stats for this month"`

### Getting reports (in the chat or dashboard)

- `"Give me my weekly report"`
- `"Monthly pattern report"`
- Or go to **Dashboard → Reports** and click a button

### Dashboard

Open your Vercel URL directly in a browser (not the PWA) to see:
- **Overview** — stats and 7-day activity strips per habit
- **Habits** — detailed numbers per habit
- **Reports** — all generated pattern analyses

---

## What Apela does NOT do

- Does not give advice or make plans
- Does not answer general knowledge questions
- Does not respond to emotional or personal questions
- Does not have multiple chat threads — one continuous conversation only

---

## Project structure

```
src/
├── lib/
│   ├── supabase.ts    # DB client + types
│   ├── agent.ts       # Gemini AI brain + system prompt
│   └── stats.ts       # Stats calculations + report generation
├── pages/
│   ├── index.tsx      # Redirects: PWA → /chat, browser → /dashboard
│   ├── chat.tsx       # WhatsApp-style chat (the PWA screen)
│   ├── dashboard.tsx  # Backend stats view
│   └── api/
│       ├── chat.ts    # Main AI endpoint
│       ├── messages.ts
│       ├── stats.ts
│       └── reports.ts
└── styles/
    └── globals.css

public/
└── manifest.json      # PWA config

supabase-schema.sql    # Run this once in Supabase SQL Editor
```

---

Built by Alphonse Otieno
