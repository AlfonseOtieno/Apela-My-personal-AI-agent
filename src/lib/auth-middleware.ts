// ── Auth middleware — used in every API route ─────────────────────
// Gets user from Authorization header, returns user_id or 401

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "./supabase";

export type AuthedUser = {
  id: string;
  email: string;
};

export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthedUser | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }

  return { id: data.user.id, email: data.user.email || "" };
}

// Get user's Gemini API key from settings, fall back to env var
import { supabaseAdmin } from "./supabase";

export async function getGeminiKey(userId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("user_settings")
    .select("gemini_key")
    .eq("user_id", userId)
    .single();

  // Use user's own key if set, otherwise fall back to env key (admin)
  return data?.gemini_key || process.env.GEMINI_API_KEY || "";
}
