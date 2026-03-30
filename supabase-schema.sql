-- ═══════════════════════════════════════════════════════════════════
-- APELA — Database Schema  (Phase 1: Habit Tracker)
-- Paste this entire file into Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── Messages (the one continuous chat log) ────────────────────────
create table if not exists messages (
  id          uuid primary key default uuid_generate_v4(),
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- ── Habit definitions (what the user is tracking) ─────────────────
create table if not exists habits (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,          -- e.g. "workout", "reading"
  unit        text not null default 'minutes',  -- minutes, pages, km, reps
  created_at  timestamptz not null default now()
);

-- ── Habit logs (each time the user reports doing something) ───────
create table if not exists habit_logs (
  id          uuid primary key default uuid_generate_v4(),
  habit_id    uuid references habits(id) on delete cascade,
  habit_name  text not null,          -- stored directly for easy querying
  duration    int,                    -- in the habit's unit
  feeling     text,                   -- "good", "tired", "bored", "great"
  note        text,                   -- any extra detail the user added
  logged_at   timestamptz not null default now(),
  date        date not null default current_date
);

-- ── Weekly reports (generated and stored so they persist) ─────────
create table if not exists reports (
  id          uuid primary key default uuid_generate_v4(),
  period      text not null,          -- "2024-W12", "2024-03", "2024"
  period_type text not null check (period_type in ('week','month','year')),
  content     text not null,          -- the full report text from Gemini
  created_at  timestamptz not null default now()
);

-- ── Indexes for fast querying ──────────────────────────────────────
create index if not exists habit_logs_date_idx on habit_logs(date desc);
create index if not exists habit_logs_habit_name_idx on habit_logs(habit_name);
create index if not exists messages_created_at_idx on messages(created_at asc);
