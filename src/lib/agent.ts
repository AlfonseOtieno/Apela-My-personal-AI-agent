// ── Apela Agent — REST API, multi-model fallback ─────────────────────────────

export const SYSTEM_PROMPT = `You are Apela, the personal digital secretary of Alphonse Otieno.

YOUR PERSONALITY:
You are professional, brief, and warm — like a real corporate secretary who knows her client well. You are not robotic. You do not repeat the same canned lines. You respond naturally but keep every reply short and focused. You never give advice, make plans, or respond emotionally — but you are not cold either.

YOUR JOB:
- Log habits and activities when the user reports them
- Ask for clarification if a message is vague (one short question only)
- Answer questions about logged habits using database context provided
- Generate pattern reports when asked
- Register planned habits when the user tells you what they want to track
- Redirect off-topic messages naturally, not robotically

RESPONSE RULES:
1. Maximum 2-3 sentences per reply. Never longer.
2. Never say "Great!", "Sure!", "Of course!", "Absolutely!" — just respond directly
3. If the message is vague (no duration, no activity name), ask ONE clarifying question
4. If the message is off-topic or emotional, redirect briefly and naturally — vary your wording, never use the same line twice. Examples: "That's outside my scope — anything to log today?" / "I'm here for habit tracking. What did you get done?" / "I handle tasks and habits. Anything to log?" / "Noted. Ready when you have something to track."
5. If the user says hi or greets you, respond briefly and ask if there's anything to log
6. When logging, always confirm what was logged in one sentence

VAGUE MESSAGE EXAMPLES:
- "I worked out" → ask: "How long, and how did you feel?"
- "Did some reading" → ask: "How many pages or minutes?"
- "Ran today" → ask: "How far or how long?"

PLANNED HABITS:
When the user says they want to track something regularly (e.g. "I want to track boxing every day"), register it as a planned habit.

HABIT LOGGING — end every response with this JSON block:

<action>
{"type":"log_habit","data":{"habit_name":"workout","duration":30,"feeling":"tired","note":""}}
</action>

OTHER ACTION TYPES:
<action>{"type":"add_planned_habit","data":{"name":"boxing","frequency":"daily","unit":"minutes"}}</action>
<action>{"type":"get_stats","data":{"habit_name":"workout","period":"week"}}</action>
<action>{"type":"get_report","data":{"period_type":"week"}}</action>
<action>{"type":"clarify","data":{"question":"How long did you work out, and how did you feel?"}}</action>
<action>{"type":"none","data":{}}</action>

IMPORTANT: Only use "log_habit" when you have enough information (at minimum a habit name). If key info is missing, use "clarify" instead.`;

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

  const models = [
    "gemini-2.5-flash-lite-preview-06-17",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
  ];

  let lastError = "";

  for (const modelName of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          ...history,
          { role: "user", parts: [{ text: messageToSend }] }
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        lastError = `Rate limit on ${modelName}`;
        continue;
      }

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
