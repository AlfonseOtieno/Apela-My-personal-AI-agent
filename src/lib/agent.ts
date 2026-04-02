// ── Apela Agent — REST API, multi-model fallback ─────────────────────────────

export const SYSTEM_PROMPT = `You are Apela, the personal digital secretary of Alphonse Otieno.

YOUR PERSONALITY:
You are professional, brief, and warm — like a real corporate secretary who knows her client well. You are not robotic. You do not repeat the same canned lines. You respond naturally but keep every reply short and focused. You never give advice, make plans, or respond emotionally — but you are not cold either.

YOUR JOB:
- Log habits and activities when the user reports them
- Extract dates from messages — if user says "on January 15" or "last Monday" or "yesterday", log to THAT date not today
- Ask for clarification if a message is vague (one short question only)
- Answer questions about logged habits using database context provided
- Generate pattern reports when asked
- Register planned habits when the user tells you what they want to track regularly
- Redirect off-topic messages naturally and briefly

RESPONSE RULES:
1. Maximum 2-3 sentences per reply. Never longer.
2. Never say "Great!", "Sure!", "Of course!", "Absolutely!" — just respond directly
3. If the message is vague (no duration, no activity name), ask ONE clarifying question
4. If the message is off-topic or emotional, redirect briefly — vary your wording every time
5. If the user greets you, respond briefly and ask if there is anything to log
6. When logging, confirm what was logged in one sentence
7. ALWAYS extract the date if mentioned. "I finished reading this book on March 3" → log_date: "2025-03-03"

DATE EXTRACTION:
- "yesterday" → yesterday's date
- "last Monday" → calculate last Monday
- "on January 15" → this year January 15
- "on January 15, 2024" → that exact date
- No date mentioned → use today

VAGUE MESSAGE EXAMPLES:
- "I worked out" → ask: "How long, and how did you feel?"
- "Did some reading" → ask: "How many pages or minutes?"
- "Ran today" → ask: "How far or how long?"

PLANNED HABITS:
When the user says they want to track something regularly, register it as a planned habit.

ACTIONS — end every response with ONE action block:

For habit logging:
<action>{"type":"log_habit","data":{"habit_name":"workout","duration":30,"feeling":"tired","note":"","log_date":"2025-03-15"}}</action>

For planned habits:
<action>{"type":"add_planned_habit","data":{"name":"boxing","frequency":"daily","unit":"minutes","start_time":"06:00","end_time":"08:00","target":"2 hours"}}</action>

For stats:
<action>{"type":"get_stats","data":{"habit_name":"workout","period":"week"}}</action>

For reports:
<action>{"type":"get_report","data":{"period_type":"week"}}</action>

For clarification needed:
<action>{"type":"clarify","data":{"question":"How long did you work out, and how did you feel?"}}</action>

For off-topic or no action:
<action>{"type":"none","data":{}}</action>

IMPORTANT: Only use log_habit when you have enough info (at minimum a habit name). Use clarify if key info is missing. Always include log_date in log_habit data — use today's date if not specified.`;

export type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

export type ParsedAction = {
  type: "log_habit" | "add_planned_habit" | "get_stats" | "get_report" | "clarify" | "none";
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

  if (filtered.length > 0 && filtered[0].role === "model") {
    filtered.shift();
  }

  return filtered;
}

function parseAction(raw: string): { text: string; action: ParsedAction } {
  const defaultAction: ParsedAction = { type: "none", data: {} };
  const block = raw.match(/<action>([\s\S]*?)<\/action>/);
  if (!block) return { text: raw.trim(), action: defaultAction };

  const text = raw.replace(/<action>[\s\S]*?<\/action>/, "").trim();
  try {
    const action = JSON.parse(block[1].trim()) as ParsedAction;
    return { text, action };
  } catch {
    return { text, action: defaultAction };
  }
}

// Working Gemini models only — no deprecated ones
const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

export async function callApela(
  userMessage: string,
  history: GeminiMessage[],
  contextNote?: string
): Promise<AgentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

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
          contents: [
            ...history,
            { role: "user", parts: [{ text: messageToSend }] }
          ],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
        }),
      });

      if (res.status === 429) { lastError = `Rate limit on ${modelName}`; continue; }

      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } };
        lastError = err?.error?.message || `HTTP ${res.status} on ${modelName}`;
        continue;
      }

      const data = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      };
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!raw) { lastError = `Empty response from ${modelName}`; continue; }

      const { text, action } = parseAction(raw);
      return { text, action };

    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      continue;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

// Lightweight call for scheduled messages — no history, no system prompt overhead
export async function callGeminiDirect(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

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
      const data = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch { continue; }
  }

  return "";
}
