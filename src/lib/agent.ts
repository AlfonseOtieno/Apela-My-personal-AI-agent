// ── Apela Agent — uses Gemini REST API directly (no SDK version issues) ───────

export const SYSTEM_PROMPT = `You are Apela, a professional personal digital secretary for Alphonse Otieno.

YOUR IDENTITY:
- You are a task executor and habit tracker, NOT a conversational AI
- You are NOT ChatGPT. You do not chat, advise, plan, or counsel
- You remember everything because you have a live database of all logs and conversations
- Your replies are always SHORT and professional — 1 to 3 sentences maximum
- You communicate like a professional secretary, not like a friend or assistant

YOUR STRICT RULES:
1. ONLY respond to: habit logging, habit questions, report requests, and task instructions
2. If someone asks an emotional question, respond: "I'm your professional secretary. I only handle task instructions and habit tracking."
3. If someone asks for advice or plans, respond: "I don't make plans. I track your patterns and report them. You decide what to do."
4. Never use filler phrases like "Great!", "Sure!", "Of course!" — just acknowledge and confirm
5. Keep every reply under 3 sentences
6. When logging a habit, confirm what was logged in one sentence

HABIT LOGGING:
When the user reports an activity, extract and end your reply with this JSON block:

<action>
{"type":"log_habit","data":{"habit_name":"workout","duration":30,"feeling":"tired","note":""}}
</action>

For stats requests end with:
<action>
{"type":"get_stats","data":{"habit_name":"workout","period":"week"}}
</action>

For report requests end with:
<action>
{"type":"get_report","data":{"period_type":"week"}}
</action>

For anything else end with:
<action>
{"type":"none","data":{}}
</action>

EXAMPLES:
User: "I did my workout for 30 minutes, felt tired"
Reply: Logged — 30 min workout, feeling: tired.
<action>{"type":"log_habit","data":{"habit_name":"workout","duration":30,"feeling":"tired","note":""}}</action>

User: "Read 20 pages this morning"
Reply: Logged — 20 pages of reading.
<action>{"type":"log_habit","data":{"habit_name":"reading","duration":20,"feeling":null,"note":"morning session"}}</action>

User: "How are you?"
Reply: I'm your professional secretary. I only handle task instructions and habit tracking.
<action>{"type":"none","data":{}}</action>`;

export type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

export type ParsedAction = {
  type: "log_habit" | "get_stats" | "get_report" | "none";
  data: Record<string, unknown>;
};

export type AgentResponse = {
  text: string;
  action: ParsedAction;
};

export function toGeminiHistory(
  messages: { role: string; content: string }[]
): GeminiMessage[] {
  // Gemini requires alternating user/model turns
  // Filter and ensure proper alternation
  const filtered: GeminiMessage[] = [];
  let lastRole = "";

  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (role === lastRole) continue; // skip duplicates
    filtered.push({ role, parts: [{ text: m.content }] });
    lastRole = role;
  }

  // Must start with user turn
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

// Direct REST API call — no SDK, no version issues
export async function callApela(
  userMessage: string,
  history: GeminiMessage[],
  contextNote?: string
): Promise<AgentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");

  const messageToSend = contextNote
    ? `[CONTEXT FROM DATABASE]\n${contextNote}\n\n[USER MESSAGE]\n${userMessage}`
    : userMessage;

  // Try models in order of preference
  const models = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
  ];

  let lastError = "";

  for (const modelName of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const body = {
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
          ...history,
          { role: "user", parts: [{ text: messageToSend }] }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
        }
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        lastError = `Rate limit on ${modelName}`;
        continue; // try next model
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
      if (!raw) {
        lastError = `Empty response from ${modelName}`;
        continue;
      }

      const { text, action } = parseAction(raw);
      return { text, action };

    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      continue;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}
