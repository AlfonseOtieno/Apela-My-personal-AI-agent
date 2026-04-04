import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

// Temporary debug endpoint — remove after fixing
// Visit: /api/debug-google to see what's stored
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin();
  
  // Check if token exists in DB
  const { data, error } = await db
    .from("oauth_tokens")
    .select("provider, expires_at, updated_at")
    .eq("provider", "google")
    .single();

  // Check env vars are set (don't expose values)
  const envCheck = {
    GOOGLE_CLIENT_ID:     !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI:  process.env.GOOGLE_REDIRECT_URI || "NOT SET",
  };

  return res.status(200).json({
    token_in_db: data || null,
    db_error:    error?.message || null,
    env_vars:    envCheck,
  });
}
