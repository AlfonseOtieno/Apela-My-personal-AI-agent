import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client — respects RLS, uses user session
export const supabase = createClient(url, anon);

// Server admin client — bypasses RLS, used in API routes
export const supabaseAdmin = () =>
  createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Get current user from session token in request headers
export async function getUserFromRequest(
  authHeader: string | undefined
): Promise<{ id: string; email: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email || "" };
}

export type Message = {
  id: string; role: "user" | "assistant"; content: string; created_at: string;
};
export type Habit = {
  id: string; name: string; unit: string; created_at: string;
};
export type HabitLog = {
  id: string; habit_id: string | null; habit_name: string;
  duration: number | null; feeling: string | null; note: string | null;
  logged_at: string; date: string;
};
export type Report = {
  id: string; period: string; period_type: "week"|"month"|"year";
  content: string; created_at: string;
};
export type UserSettings = {
  id: string; user_id: string; gemini_key: string | null;
  display_name: string | null; created_at: string;
};
