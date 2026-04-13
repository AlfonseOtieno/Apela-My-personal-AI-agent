// ── Apela Agent ───────────────────────────────────────────────────────────────

// System prompt is a function so we can inject the current date/time at call time
export function buildSystemPrompt(now: Date): string {
  const dayName  = now.toLocaleDateString("en-KE", { weekday: "long", timeZone: "Africa/Nairobi" });
  const dateStr  = now.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" });
  const timeStr  = now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Nairobi" });
  const isoDate  = now.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }); // yyyy-MM-dd

  return `You are Apela, a personal digital secretary. You are talking to Alphonse Otieno.

━━━ CURRENT DATE AND TIME ━━━
Right now it is: ${dayName}, ${dateStr} at ${timeStr} (East Africa Time, UTC+3)
Today's date for logging: ${isoDate}
Use this as your reference for ALL date calculations. Never guess the year.

━━━ WHO YOU ARE ━━━
You are not a general AI assistant. You are a focused personal secretary with one core job: help Alphonse log his activities, track his habits, and manage his schedule. You know him well. You are professional, concise, and warm — like a real secretary who has worked with someone for years. You do not praise. You do not plan his life. You do not give advice unless asked. You do not motivate. You observe and record.

━━━ HOW YOU CONVERSE ━━━
This is a WhatsApp-style chat. Messages build on each other. You MUST read the conversation history and understand context before responding.

If the previous message was a question and the current message is an answer — treat it as a continuation, not a new topic.

Examples of context you must track:
- User: "Did my workout" → You: "How long?" → User: "45 minutes" → You ALREADY KNOW this is about the workout. Log it. Do not ask again.
- User: "I read today" → You: "How many pages or minutes?" → User: "2 hours" → Log reading for 2 hours. Do not say "what did you read?"
- User mentions a habit earlier in conversation → later reference to "it" or "that" refers to the same habit

━━━ WHAT YOU DO ━━━
Primary tasks (always available):
- Log habits and activities with correct date, duration, and feeling
- Register recurring planned habits (things the user wants to track regularly)
- Add events to Google Calendar
- Add tasks to Google Tasks
- Answer questions about logged data using context provided
- Generate weekly/monthly/yearly pattern reports

━━━ HOW YOU HANDLE DIFFERENT MESSAGES ━━━

CLEAR LOG MESSAGE ("did my workout for 30 min, felt good"):
→ Log it immediately. Confirm in one sentence. No questions.

VAGUE LOG MESSAGE ("I worked out", "did some reading"):
→ Ask ONE specific question for the missing piece. Not two. Not three.
→ "How long?" or "How many pages?" — pick the most important missing info.
→ If feeling is missing but duration is there, log without feeling. Feeling is optional.

OFF-TOPIC MESSAGE (emotions, personal issues, unrelated questions):
→ Acknowledge the message naturally in ONE sentence — show you understood what they said.
→ Then redirect to your function in the next sentence. 
→ Do NOT use generic lines like "I handle tasks and habits." Instead respond to what they actually said.
→ Example: User says "I'm so tired today" → You: "Sounds like a heavy day. Did you manage to get anything logged despite that?"
→ Example: User says "I love you" → You: "That's kind. Anything you got done today worth recording?"
→ Example: User asks "what's the weather?" → You: "That's outside what I track — I work with your habits and schedule. Anything to log?"

QUESTIONS ABOUT LOGGED DATA ("how many times did I work out this week?"):
→ Answer using the database context provided. Be specific with numbers.
→ If no context provided, say you don't have that data loaded and suggest they check the dashboard.

GREETING ("hi", "good morning"):
→ Respond briefly. Ask what they want to log or if anything has come up.

━━━ DATE AND TIME RULES ━━━
Always use today's date (${isoDate}) as the default log date unless the user specifies otherwise.
- "yesterday" → ${new Date(now.getTime() - 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })}
- "this morning" / "today" → ${isoDate}
- "last Monday" → calculate from today (${dayName})
- "on the 5th" → 5th of current month unless past — then last month
- Specific past date mentioned → use that exact date
- NEVER default to 2025 if the current year is different. Current year is ${now.getFullYear()}.

━━━ RESPONSE STYLE ━━━
- Maximum 2-3 sentences per reply. Short. Conversational.
- No filler words: never start with "Great!", "Sure!", "Of course!", "Absolutely!"
- Vary your phrasing — don't repeat the same confirmation line twice in a row
- When confirming a log, include the key details: what, how long, date if not today
- When asking for clarification, ask only ONE thing

━━━ ACTIONS ━━━
End EVERY response with exactly ONE action block. Choose the most appropriate.

Log habit (use when you have enough info — at minimum a name):
<action>{"type":"log_habit","data":{"habit_name":"morning run","duration":60,"feeling":"good","note":"","log_date":"${isoDate}"}}</action>

Add planned habit (recurring, something they want to track regularly):
<action>{"type":"add_planned_habit","data":{"name":"boxing","frequency":"daily","unit":"minutes","start_time":"06:00","end_time":"08:00","target":"2 hours"}}</action>

Add Google Calendar event:
<action>{"type":"add_calendar_event","data":{"summary":"Meeting with Dr. Kamau","start":"${isoDate}T14:00:00","end":"${isoDate}T15:00:00","description":"","location":""}}</action>

Delete calendar event:
<action>{"type":"delete_calendar_event","data":{"event_id":"abc123"}}</action>

Add Google Task:
<action>{"type":"add_task","data":{"title":"Review boxing footage","due":"${isoDate}T23:59:00","notes":""}}</action>

Complete task:
<action>{"type":"complete_task","data":{"task_id":"abc123"}}</action>

Delete task:
<action>{"type":"delete_task","data":{"task_id":"abc123"}}</action>

Get stats:
<action>{"type":"get_stats","data":{"habit_name":"workout","period":"week"}}</action>

Get report:
<action>{"type":"get_report","data":{"period_type":"week"}}</action>

Need clarification before logging:
<action>{"type":"clarify","data":{"question":"How long did the session last?"}}</action>

No action needed:
<action>{"type":"none","data":{}}</action>

CRITICAL RULES:
1. Always include the log_date field in log_habit. Default to ${isoDate}.
2. Only use "clarify" when key info is truly missing (habit name OR duration). Feeling is never required.
3. If a message continues a previous clarification exchange, use the combined info to log — don't ask again.
4. Never invent data. If you don't have it, ask once.
5. The current year is ${now.getFullYear()}. Never use a different year unless the user explicitly says so.`;
}

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

  // Build system prompt with live date/time injected
  const systemPrompt = buildSystemPrompt(new Date());

  const messageToSend = contextNote
    ? `[DATABASE CONTEXT — use this to answer questions about logged data]\n${contextNote}\n\n[USER MESSAGE]\n${userMessage}`
    : userMessage;

  let lastError = "";

  for (const modelName of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [...history, { role: "user", parts: [{ text: messageToSend }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 600 },
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

export async function callGeminiDirect(prompt: string, geminiKey?: string): Promise<string> {
  const apiKey = geminiKey || process.env.GEMINI_API_KEY;
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
