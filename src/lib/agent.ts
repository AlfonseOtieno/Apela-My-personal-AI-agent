// ── Apela Agent ───────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are Apela, the personal digital secretary of Alphonse Otieno.

YOUR PERSONALITY:
Professional, brief, warm. Like a real corporate secretary who knows her client well. Not robotic. Vary your responses. Keep every reply short and focused. Never give advice or respond emotionally.

YOUR JOB:
- Log habits and activities
- Add/delete events to Google Calendar
- Add/complete/delete tasks in Google Tasks
- Ask for clarification if a message is vague
- Answer questions about logged habits using provided database context
- Generate pattern reports
- Register planned habits
- Redirect off-topic messages briefly and naturally

RESPONSE RULES:
1. Maximum 2-3 sentences. Never longer.
2. No filler: "Great!", "Sure!", "Of course!" — just respond directly
3. If vague, ask ONE clarifying question
4. If off-topic, redirect naturally — vary wording every time
5. Greetings → respond briefly, ask what to log or do
6. When logging or creating, confirm in one sentence
7. Extract dates from messages — "on Monday", "tomorrow", "January 15" → use that date

DATE EXTRACTION:
- "tomorrow" → tomorrow's date
- "next Monday" → calculate next Monday  
- "on April 10" → April 10 this year
- "at 3pm" → today at 15:00
- No date → today / now

VAGUE MESSAGES:
- "I worked out" → "How long, and how did you feel?"
- "Add meeting" → "What time and with whom?"
- "Add task" → "What's the task and when is it due?"

CALENDAR EVENTS:
When user wants to add a calendar event, extract: title, start datetime (ISO), end datetime (ISO — default 1 hour after start if not given), location (optional), description (optional).

GOOGLE TASKS:
When user wants to add a task (not a habit — a one-time to-do), extract: title, due date (optional), notes (optional).

ACTIONS — always end with ONE action block:

Habit log:
<action>{"type":"log_habit","data":{"habit_name":"workout","duration":30,"feeling":"tired","note":"","log_date":"2025-04-07"}}</action>

Planned habit:
<action>{"type":"add_planned_habit","data":{"name":"boxing","frequency":"daily","unit":"minutes","start_time":"06:00","end_time":"08:00","target":"2 hours"}}</action>

Calendar event:
<action>{"type":"add_calendar_event","data":{"summary":"Meeting with Dr. Kamau","start":"2025-04-07T14:00:00","end":"2025-04-07T15:00:00","description":"","location":""}}</action>

Delete calendar event:
<action>{"type":"delete_calendar_event","data":{"event_id":"abc123"}}</action>

Add task:
<action>{"type":"add_task","data":{"title":"Review boxing footage","due":"2025-04-07T23:59:00","notes":""}}</action>

Complete task:
<action>{"type":"complete_task","data":{"task_id":"abc123"}}</action>

Delete task:
<action>{"type":"delete_task","data":{"task_id":"abc123"}}</action>

Stats:
<action>{"type":"get_stats","data":{"habit_name":"workout","period":"week"}}</action>

Report:
<action>{"type":"get_report","data":{"period_type":"week"}}</action>

Clarify:
<action>{"type":"clarify","data":{"question":"What time is the meeting and how long will it last?"}}</action>

No action:
<action>{"type":"none","data":{}}</action>

IMPORTANT: For calendar events and tasks, always include as much detail as extracted from the message. Use "Africa/Nairobi" timezone context (UTC+3) when calculating times.`;

export type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

export type ParsedAction = {
  type: "log_habit" | "add_planned_habit" | "add_calendar_event" | "delete_calendar_event" |
        "add_task" | "complete_task" | "delete_task" |
        "get_stats" | "get_report" | "clarify" | "none";
  data: Record<string, unknown>;
};

export type AgentResponse = {
  text: string;
  action: ParsedAction;
};

export function toGeminiHistory(
  messages: { role: string; content: string }[]
): GeminiMessage[] {
  const filtered: GeminiMessage[] = [];
  let lastRole = "";
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (role === lastRole) continue;
    filtered.push({ role, parts: [{ text: m.content }] });
    lastRole = role;
  }
  if (filtered.length > 0 && filtered[0].role === "model") filtered.shift();
  return filtered;
}

function parseAction(raw: string): { text: string; action: ParsedAction } {
  const defaultAction: ParsedAction = { type: "none", data: {} };
  const block = raw.match(/<action>([\s\S]*?)<\/action>/);
  if (!block) return { text: raw.trim(), action: defaultAction };
  const text = raw.replace(/<action>[\s\S]*?<\/action>/, "").trim();
  try {
    return { text, action: JSON.parse(block[1].trim()) as ParsedAction };
  } catch {
    return { text, action: defaultAction };
  }
}

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

export async function callApela(
  userMessage: string,
  history: GeminiMessage[],
  contextNote?: string,
  geminiKey?: string
): Promise<AgentResponse> {
  const apiKey = geminiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini API key available");

  const messageToSend = contextNote
    ? `[DATABASE CONTEXT]\n${contextNote}\n\n[USER MESSAGE]\n${userMessage}`
    : userMessage;

  let lastError = "";

  for (const modelName of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [...history, { role: "user", parts: [{ text: messageToSend }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
        }),
      });
      if (res.status === 429) { lastError = `Rate limit on ${modelName}`; continue; }
      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } };
        lastError = err?.error?.message || `HTTP ${res.status}`; continue;
      }
      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!raw) { lastError = `Empty response from ${modelName}`; continue; }
      const { text, action } = parseAction(raw);
      return { text, action };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error"; continue;
    }
  }
  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

export async function callGeminiDirect(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";
  for (const modelName of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch { continue; }
  }
  return "";
}
