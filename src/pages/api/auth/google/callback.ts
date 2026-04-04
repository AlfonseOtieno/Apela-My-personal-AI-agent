import type { NextApiRequest, NextApiResponse } from "next";
import { exchangeCodeForTokens } from "@/lib/google";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect("/dashboard?tab=google&error=access_denied");
  }

  if (!code || typeof code !== "string") {
    return res.redirect("/dashboard?tab=google&error=no_code");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const db = supabaseAdmin();

    await db.from("oauth_tokens").upsert([{
      provider:      "google",
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at:    new Date().toISOString(),
    }], { onConflict: "provider" });

    return res.redirect("/dashboard?tab=google&connected=true");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Google OAuth error:", msg);
    return res.redirect(`/dashboard?tab=google&error=${encodeURIComponent(msg)}`);
  }
}
