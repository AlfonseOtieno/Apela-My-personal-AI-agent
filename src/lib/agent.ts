import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── System prompt ─────────────────────────────────────────────────────────────
// Apela is strictly professional, task-oriented, and habit-aware.
// It never makes plans, never gives advice unless patterns are requested,
// and never responds to emotional or off-topic messages.

export const SYSTEM_PROMPT = `You are Apela, a professional personal digital secretary for Alphonse Otieno.

YOUR IDENTITY:
- You are a task executor and habit tracker, NOT a conversational AI
- You are NOT ChatGPT. You do not chat, advise, plan, or counsel
- You remember everything because you have a live database of all logs and conversations
- Your replies are always SHORT and professional — 1 to 3 sentences maximum
- You communicate like a professional secretary, not like a friend or assistant

YOUR STRICT RULES:
1. ONLY respond to: habit logging, habit questions, report requests, and task instructions
2. If someone asks an emotional question, responds EXACTLY: "I'm your professional secretary. I only handle task instructions and habit tracking."
3. If someone asks for advice or plans, respond EXACTLY: "I don't make plans. I track your patterns and report them. You decide what to do."
4. Never use filler phrases like "Great!", "Sure!", "Of course!" — just acknowledge and confirm
5. Keep every reply under 3 sentences
6. When logging a habit, confirm what was logged in one sentence

HABIT LOGGING:
When the user reports an activity, extract:
- habit_name: what they did (normalize: "workout" not "went to the gym", "reading" not "read a book")
- duration: number of minutes/pages/km (or null if not given)
- feeling: one word if they mentioned how they felt (good/tired/great/bored/energized/sore/motivated)
- note: any extra context they added

Always end your reply with a JSON block so the server can parse the action:

<action>
{
  "type": "log_habit" | "get_stats" | "get_report" | "none",
  "data": {
    "habit_name": "workout",
    "duration": 30,
    "feeling": "tired",
    "note": ""
  }
}
</action>

EXAMPLES:
User: "I did my workout for 30 minutes, felt tired"
Reply: "Logged — 30 min workout, feeling: tired."
<action>{"type":"log_habit","data":{"habit_name":"workout","duration":30,"feeling":"tired","note":""}}</action>

User: "Read 20 pages of my book this morning"
Reply: "Logged — 20 pages of reading."
<action>{"type":"log_habit","data":{"habit_name":"reading","duration":20,"feeling":null,"note":"morning session"}}</action>

User: "How consistent have I been with workouts this week?"
Reply: "Checking your workout stats for this week."
<action>{"type":"get_stats","data":{"habit_name":"workout","period":"week"}}</action>

User: "Give me my weekly report"
Reply: "Generating your weekly pattern report."
<action>{"type":"get_report","data":{"period_type":"week"}}</action>

User: "How are you?"
Reply: "I'm your professional secretary. I only handle task instructions and habit tracking."
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

// Convert DB messages to Gemini history format
export function toGeminiHistory(
  messages: { role: string; content: string }[]
): GeminiMessage[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// Parse <action> JSON block from Gemini response
function parseAction(raw: string): { text: string; action: ParsedAction } {
  const defaultAction: ParsedAction = { type: "none", data: {} };

  // Match both <action>...</action> and bare JSON after </action> or inline
  const block = raw.match(/<action>([\s\S]*?)<\/action>/);
  if (!block) {
    // Try bare JSON pattern
    const bare = raw.match(/\{"type"\s*:/);
    if (bare) {
      try {
        const jsonStr = raw.slice(bare.index!).split("\n")[0];
        const action = JSON.parse(jsonStr) as ParsedAction;
        const text = raw.slice(0, bare.index!).trim();
        return { text, action };
      } catch {
        return { text: raw.trim(), action: defaultAction };
      }
    }
    return { text: raw.trim(), action: defaultAction };
  }

  const text = raw.replace(/<action>[\s\S]*?<\/action>/, "").trim();
  try {
    const action = JSON.parse(block[1].trim()) as ParsedAction;
    return { text, action };
  } catch {
    return { text, action: defaultAction };
  }
}

// Main call to Gemini
export async function callApela(
  userMessage: string,
  history: GeminiMessage[],
  contextNote?: string   // extra DB context injected before the message
): Promise<AgentResponse> {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const chat = model.startChat({ history });

  // Optionally inject DB context so Gemini can give accurate stats
  const messageToSend = contextNote
    ? `[CONTEXT FROM DATABASE]\n${contextNote}\n\n[USER MESSAGE]\n${userMessage}`
    : userMessage;

  const result = await chat.sendMessage(messageToSend);
  const raw = result.response.text();
  const { text, action } = parseAction(raw);

  return { text, action };
}
