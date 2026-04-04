// ── Google OAuth + Calendar + Tasks ──────────────────────────────────────────
// Uses Google REST APIs directly — no SDK needed

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
].join(" ");

// ── OAuth URL ─────────────────────────────────────────────────────────────────
export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ── Exchange code for tokens ──────────────────────────────────────────────────
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.json() as { error_description?: string };
    throw new Error(err.error_description || "Token exchange failed");
  }
  return res.json();
}

// ── Refresh access token ──────────────────────────────────────────────────────
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ── Get stored token from Supabase, refresh if needed ────────────────────────
import { supabaseAdmin } from "./supabase";

export async function getValidAccessToken(): Promise<string> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("oauth_tokens")
    .select("*")
    .eq("provider", "google")
    .single();

  if (error || !data) throw new Error("Google not connected. Go to Dashboard → Google tab to connect.");

  // Check if expired (with 5 min buffer)
  const expiresAt = new Date(data.expires_at).getTime();
  const now = Date.now();

  if (expiresAt - now < 5 * 60 * 1000) {
    // Refresh
    const newToken = await refreshAccessToken(data.refresh_token);
    const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
    await db.from("oauth_tokens").update({
      access_token: newToken,
      expires_at:   newExpiry,
      updated_at:   new Date().toISOString(),
    }).eq("provider", "google");
    return newToken;
  }

  return data.access_token;
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────

export type CalendarEvent = {
  id?: string;
  summary: string;
  description?: string;
  start: string;     // ISO datetime
  end: string;       // ISO datetime
  location?: string;
};

export async function listTodayEvents(): Promise<CalendarEvent[]> {
  const token = await getValidAccessToken();
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: "true", orderBy: "startTime", maxResults: "20" });

  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch calendar events");

  const data = await res.json() as { items?: { id: string; summary: string; description?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; location?: string }[] };
  return (data.items || []).map(e => ({
    id:          e.id,
    summary:     e.summary || "Untitled",
    description: e.description,
    start:       e.start.dateTime || e.start.date || "",
    end:         e.end.dateTime   || e.end.date   || "",
    location:    e.location,
  }));
}

export async function listUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const token = await getValidAccessToken();
  const start = new Date().toISOString();
  const end   = new Date(Date.now() + days * 86400000).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: "true", orderBy: "startTime", maxResults: "20" });

  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch upcoming events");

  const data = await res.json() as { items?: { id: string; summary: string; description?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; location?: string }[] };
  return (data.items || []).map(e => ({
    id:          e.id,
    summary:     e.summary || "Untitled",
    description: e.description,
    start:       e.start.dateTime || e.start.date || "",
    end:         e.end.dateTime   || e.end.date   || "",
    location:    e.location,
  }));
}

export async function createCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
  const token = await getValidAccessToken();
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary:     event.summary,
      description: event.description,
      location:    event.location,
      start: { dateTime: event.start, timeZone: "Africa/Nairobi" },
      end:   { dateTime: event.end,   timeZone: "Africa/Nairobi" },
    }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err?.error?.message || "Failed to create event");
  }
  const data = await res.json() as { id: string; summary: string; start: { dateTime?: string }; end: { dateTime?: string } };
  return { id: data.id, summary: data.summary, start: data.start.dateTime || "", end: data.end.dateTime || "" };
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const token = await getValidAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete event");
}

// ── TASKS ─────────────────────────────────────────────────────────────────────

export type Task = {
  id?: string;
  title: string;
  notes?: string;
  due?: string;   // RFC 3339
  status?: "needsAction" | "completed";
};

const DEFAULT_TASKLIST = "@default";

export async function listTasks(): Promise<Task[]> {
  const token = await getValidAccessToken();
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${DEFAULT_TASKLIST}/tasks?showCompleted=false&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch tasks");
  const data = await res.json() as { items?: { id: string; title: string; notes?: string; due?: string; status?: string }[] };
  return (data.items || []).map(t => ({
    id:     t.id,
    title:  t.title,
    notes:  t.notes,
    due:    t.due,
    status: (t.status as Task["status"]) || "needsAction",
  }));
}

export async function createTask(task: Task): Promise<Task> {
  const token = await getValidAccessToken();
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${DEFAULT_TASKLIST}/tasks`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: task.title, notes: task.notes, due: task.due }),
    }
  );
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err?.error?.message || "Failed to create task");
  }
  const data = await res.json() as { id: string; title: string; notes?: string; due?: string };
  return { id: data.id, title: data.title, notes: data.notes, due: data.due };
}

export async function completeTask(taskId: string): Promise<void> {
  const token = await getValidAccessToken();
  await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${DEFAULT_TASKLIST}/tasks/${taskId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }
  );
}

export async function deleteTask(taskId: string): Promise<void> {
  const token = await getValidAccessToken();
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${DEFAULT_TASKLIST}/tasks/${taskId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete task");
}
