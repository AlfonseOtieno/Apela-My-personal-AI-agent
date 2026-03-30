import { supabaseAdmin } from "./supabase";
import type { HabitLog } from "./supabase";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, parseISO } from "date-fns";

// ── Fetch logs for a period ───────────────────────────────────────────────────
export async function getLogsForPeriod(
  habitName: string | null,
  from: Date,
  to: Date
): Promise<HabitLog[]> {
  const db = supabaseAdmin();
  let q = db
    .from("habit_logs")
    .select("*")
    .gte("date", format(from, "yyyy-MM-dd"))
    .lte("date", format(to, "yyyy-MM-dd"))
    .order("date", { ascending: true });

  if (habitName) q = q.ilike("habit_name", `%${habitName}%`);

  const { data } = await q;
  return data || [];
}

// ── Build a stat summary string for Gemini context ───────────────────────────
export function buildStatContext(logs: HabitLog[], label: string): string {
  if (!logs.length) return `No logs found for ${label}.`;

  const byDay: Record<string, HabitLog[]> = {};
  logs.forEach((l) => {
    byDay[l.date] = byDay[l.date] || [];
    byDay[l.date].push(l);
  });

  const days = Object.keys(byDay).sort();
  const totalSessions = logs.length;
  const totalDuration = logs.reduce((s, l) => s + (l.duration || 0), 0);
  const feelings = logs.map((l) => l.feeling).filter(Boolean);
  const feelingCount: Record<string, number> = {};
  feelings.forEach((f) => { feelingCount[f!] = (feelingCount[f!] || 0) + 1; });

  const lines = [
    `Period: ${label}`,
    `Total sessions: ${totalSessions}`,
    `Total duration: ${totalDuration} mins`,
    `Active days: ${days.length}`,
    `Days logged: ${days.join(", ")}`,
    feelings.length ? `Feelings: ${JSON.stringify(feelingCount)}` : "",
    `Log detail: ${logs.map(l => `${l.date} — ${l.habit_name} ${l.duration ? l.duration + ' mins' : ''} ${l.feeling ? '('+l.feeling+')' : ''} ${l.note || ''}`).join(" | ")}`,
  ].filter(Boolean);

  return lines.join("\n");
}

// ── Generate a pattern analysis using Gemini ─────────────────────────────────
export async function generateReport(
  periodType: "week" | "month" | "year"
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const now = new Date();
  let from: Date, to: Date, label: string;

  if (periodType === "week") {
    from = startOfWeek(now, { weekStartsOn: 1 });
    to = endOfWeek(now, { weekStartsOn: 1 });
    label = `Week of ${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
  } else if (periodType === "month") {
    from = startOfMonth(now);
    to = endOfMonth(now);
    label = format(now, "MMMM yyyy");
  } else {
    from = startOfYear(now);
    to = endOfYear(now);
    label = format(now, "yyyy");
  }

  const logs = await getLogsForPeriod(null, from, to);
  const context = buildStatContext(logs, label);

  const prompt = `You are Apela, a professional digital secretary analyzing habit data for your user.

Here is the raw habit log data:
${context}

Write a ${periodType}ly pattern report. Rules:
- Be factual and specific, cite actual numbers
- Identify patterns (e.g. which days are strong, which are weak, time-of-day patterns if available)
- Do NOT make plans or suggestions
- Do NOT say "you should" or "I recommend"
- Just describe what the data shows — patterns, consistency, trends
- Use short paragraphs, no bullet points
- Maximum 200 words
- End with one sentence about the single most notable pattern you see

Start directly with the report, no greeting.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── Get streak for a habit ────────────────────────────────────────────────────
export async function getStreak(habitName: string): Promise<number> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("habit_logs")
    .select("date")
    .ilike("habit_name", `%${habitName}%`)
    .order("date", { ascending: false })
    .limit(90);

  if (!data?.length) return 0;

  const dates = Array.from(new Set(data.map((d) => d.date))).sort().reverse();
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 0;
  let check = dates[0] === today ? new Date() : new Date(Date.now() - 86400000);

  for (const date of dates) {
    if (date === format(check, "yyyy-MM-dd")) {
      streak++;
      check = new Date(check.getTime() - 86400000);
    } else {
      break;
    }
  }

  return streak;
}

// ── Get all-time stats per habit for the dashboard ───────────────────────────
export async function getAllHabitStats() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("habit_logs")
    .select("habit_name, duration, date, feeling")
    .order("date", { ascending: false });

  if (!data?.length) return [];

  // Group by habit
  const byHabit: Record<string, typeof data> = {};
  data.forEach((l) => {
    byHabit[l.habit_name] = byHabit[l.habit_name] || [];
    byHabit[l.habit_name].push(l);
  });

  return Object.entries(byHabit).map(([name, logs]) => {
    const totalSessions = logs.length;
    const totalDuration = logs.reduce((s, l) => s + (l.duration || 0), 0);
    const uniqueDays = [...new Set(logs.map((l) => l.date))];

    // Day-of-week frequency
    const dayFreq: Record<string, number> = {};
    uniqueDays.forEach((d) => {
      const day = format(parseISO(d), "EEE");
      dayFreq[day] = (dayFreq[day] || 0) + 1;
    });
    const bestDay = Object.entries(dayFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    // Last 7 days activity
    const last7 = eachDayOfInterval({
      start: new Date(Date.now() - 6 * 86400000),
      end: new Date(),
    }).map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dayLogs = logs.filter((l) => l.date === key);
      return { date: key, label: format(d, "EEE"), done: dayLogs.length > 0, duration: dayLogs.reduce((s, l) => s + (l.duration || 0), 0) };
    });

    return { name, totalSessions, totalDuration, uniqueDays: uniqueDays.length, bestDay, last7 };
  });
}
