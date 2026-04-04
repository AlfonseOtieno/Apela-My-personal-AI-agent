import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin();

  // Use select without .single() to avoid the coerce error
  const { data, error } = await db
    .from("oauth_tokens")
    .select("provider, expires_at, updated_at")
    .eq("provider", "google");

  const envCheck = {
    GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.slice(0, 20) + "..." : "NOT SET",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "SET (hidden)" : "NOT SET",
    GOOGLE_REDIRECT_URI:  process.env.GOOGLE_REDIRECT_URI || "NOT SET",
  };

  // Also try a direct insert test to verify the table works
  const testInsert = await db
    .from("oauth_tokens")
    .select("*")
    .limit(1);

  return res.status(200).json({
    token_found:    data && data.length > 0,
    token_data:     data?.[0] || null,
    db_error:       error?.message || null,
    table_check:    testInsert.error ? testInsert.error.message : "table OK",
    env_vars:       envCheck,
  });
}
