import { supabaseAdmin } from "./supabase";
import type { HabitLog } from "./supabase";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, eachDayOfInterval, parseISO
} from "date-fns";

// ── Fetch logs for a period ───────────────────────────────────────────────────
export async function getLogsForPeriod(
  habitName: string | null,
  from: Date,
  to: Date,
  userId?: string
): Promise<HabitLog[]> {
  const db = supabaseAdmin();
  let q = db
    .from("habit_logs")
    .select("*")
    .gte("date", format(from, "yyyy-MM-dd"))
    .lte("date", format(to, "yyyy-MM-dd"))
    .order("date", { ascending: true });

  if (habitName) q = q.ilike("habit_name", `%${habitName}%`);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return data || [];
}

// ── Fetch planned habits ──────────────────────────────────────────────────────
export async function getPlannedHabits(userId?: string) {
  const db = supabaseAdmin();
  let q = db.from("planned_habits").select("*").eq("active", true).order("created_at", { ascending: true });
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return data || [];
}

// ── Build stat context string for Gemini ──────────────────────────────────────
export function buildStatContext(logs: HabitLog[], label: string): string {
  if (!logs.length) return `No logs found for ${label}.`;

  const byDay: Record<string, HabitLog[]> = {};
  logs.forEach(l => { byDay[l.date] = byDay[l.date] || []; byDay[l.date].push(l); });

  const days = Object.keys(byDay).sort();
  const totalSessions = logs.length;
  const totalDuration = logs.reduce((s, l) => s + (l.duration || 0), 0);
  const feelings = logs.map(l => l.feeling).filter(Boolean);
  const feelingCount: Record<string, number> = {};
  feelings.forEach(f => { feelingCount[f!] = (feelingCount[f!] || 0) + 1; });

  return [
    `Period: ${label}`,
    `Total sessions: ${totalSessions}`,
    `Total duration: ${totalDuration} mins`,
    `Active days: ${days.length}`,
    `Days logged: ${days.join(", ")}`,
    feelings.length ? `Feelings breakdown: ${JSON.stringify(feelingCount)}` : "",
    `Full log: ${logs.map(l =>
      `${l.date} (${format(parseISO(l.date), "EEE")}) — ${l.habit_name}` +
      (l.duration ? ` ${l.duration} mins` : "") +
      (l.feeling ? ` [${l.feeling}]` : "") +
      (l.note ? ` — "${l.note}"` : "")
    ).join(" | ")}`,
  ].filter(Boolean).join("\n");
}

// ── Generate weekly pattern report ───────────────────────────────────────────
export async function generateReport(
  periodType: "week" | "month" | "year",
  userId?: string,
  geminiKey?: string
): Promise<string> {
  const now = new Date();
  let from: Date, to: Date, label: string;

  if (periodType === "week") {
    from  = startOfWeek(now, { weekStartsOn: 1 });
    to    = endOfWeek(now, { weekStartsOn: 1 });
    label = `Week of ${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
  } else if (periodType === "month") {
    from  = startOfMonth(now);
    to    = endOfMonth(now);
    label = format(now, "MMMM yyyy");
  } else {
    from  = startOfYear(now);
    to    = endOfYear(now);
    label = format(now, "yyyy");
  }

  const [logs, planned] = await Promise.all([
    getLogsForPeriod(null, from, to, userId),
    getPlannedHabits(userId),
  ]);

  const logContext = buildStatContext(logs, label);

  // Build missed habits context
  const plannedNames = planned.map(p => p.name);
  const loggedNames  = Array.from(new Set(logs.map(l => l.habit_name)));
  const missed       = plannedNames.filter(p => !loggedNames.some(l => l.toLowerCase().includes(p.toLowerCase())));

  const missedContext = missed.length
    ? `Planned habits NOT logged this period: ${missed.join(", ")}`
    : "All planned habits were logged at least once this period.";

  // Research-grounded pattern analysis prompt
  const prompt = `You are Apela, a professional digital secretary generating a ${periodType}ly habit pattern report.

RAW HABIT DATA:
${logContext}

PLANNED HABITS: ${plannedNames.length > 0 ? plannedNames.join(", ") : "None set yet"}
${missedContext}

Write a concise pattern report following these behavioral science principles:

1. CONSISTENCY — Which days were strongest? Which were weakest? State actual numbers.
2. FEELING PATTERNS — Do certain days or habits consistently correlate with specific feelings (tired, good, energized)? Only report this if the data shows it — don't invent it.
3. MISSED HABITS — Which planned habits were skipped and on which days? 
4. STREAK ANALYSIS — Are there any multi-day runs of consistency or gaps?
5. ONE KEY INSIGHT — End with a single sentence describing the most notable pattern in the data.

STRICT RULES:
- Be factual. Only report what the data actually shows.
- Do NOT say "you should" or "I recommend" or make any plans or suggestions.
- Do NOT use bullet points. Write in short paragraphs.
- Maximum 180 words.
- Start directly with the data. No greeting, no "Here is your report".
- Write as if you are a professional secretary reporting observed facts to your employer.`;

  const models = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash-latest"];

  const apiKey = geminiKey || process.env.GEMINI_API_KEY!;
  for (const modelName of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
        })
      });
      if (!res.ok) continue;
      const data = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch { continue; }
  }

  return "Report generation failed. Please try again.";
}

// ── Get streak ────────────────────────────────────────────────────────────────
export async function getStreak(habitName: string, userId?: string): Promise<number> {
  const db = supabaseAdmin();
  let q = db
    .from("habit_logs")
    .select("date")
    .ilike("habit_name", `%${habitName}%`)
    .order("date", { ascending: false })
    .limit(90);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;

  if (!data?.length) return 0;

  const dates = Array.from(new Set(data.map(d => d.date))).sort().reverse();
  const today     = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 0;
  let check = dates[0] === today ? new Date() : new Date(Date.now() - 86400000);

  for (const date of dates) {
    if (date === format(check, "yyyy-MM-dd")) {
      streak++;
      check = new Date(check.getTime() - 86400000);
    } else break;
  }

  return streak;
}

// ── Get all habit stats for dashboard ────────────────────────────────────────
export async function getAllHabitStats(userId?: string) {
  const db = supabaseAdmin();
  let q = db
    .from("habit_logs")
    .select("habit_name, duration, date, feeling")
    .order("date", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;

  if (!data?.length) return [];

  const byHabit: Record<string, typeof data> = {};
  data.forEach(l => {
    byHabit[l.habit_name] = byHabit[l.habit_name] || [];
    byHabit[l.habit_name].push(l);
  });

  return Object.entries(byHabit).map(([name, logs]) => {
    const totalSessions = logs.length;
    const totalDuration = logs.reduce((s, l) => s + (l.duration || 0), 0);
    const uniqueDays    = Array.from(new Set(logs.map(l => l.date)));

    const dayFreq: Record<string, number> = {};
    uniqueDays.forEach(d => {
      const day = format(parseISO(d), "EEE");
      dayFreq[day] = (dayFreq[day] || 0) + 1;
    });
    const bestDay = Object.entries(dayFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    const last7 = eachDayOfInterval({
      start: new Date(Date.now() - 6 * 86400000),
      end:   new Date(),
    }).map(d => {
      const key     = format(d, "yyyy-MM-dd");
      const dayLogs = logs.filter(l => l.date === key);
      return {
        date:     key,
        label:    format(d, "EEE"),
        done:     dayLogs.length > 0,
        duration: dayLogs.reduce((s, l) => s + (l.duration || 0), 0),
      };
    });

    return { name, totalSessions, totalDuration, uniqueDays: uniqueDays.length, bestDay, last7 };
  });
}
