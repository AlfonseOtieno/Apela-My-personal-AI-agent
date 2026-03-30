import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-safe client (used in frontend components)
export const supabase = createClient(url, anon);

// Server-only admin client (used in API routes only)
export const supabaseAdmin = () =>
  createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ── Types ─────────────────────────────────────────────────────────

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Habit = {
  id: string;
  name: string;
  unit: string;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string | null;
  habit_name: string;
  duration: number | null;
  feeling: string | null;
  note: string | null;
  logged_at: string;
  date: string;
};

export type Report = {
  id: string;
  period: string;
  period_type: "week" | "month" | "year";
  content: string;
  created_at: string;
};
