import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/dashboard?tab=google&error=${encodeURIComponent(String(error))}`);
  }

  if (!code || typeof code !== "string") {
    return res.redirect("/dashboard?tab=google&error=no_code_received");
  }

  try {
    // Exchange code for tokens directly here — no lib import
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
        grant_type:    "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || "Token exchange failed";
      console.error("Google token exchange error:", errMsg, JSON.stringify(tokenData));
      return res.redirect(`/dashboard?tab=google&error=${encodeURIComponent(errMsg)}`);
    }

    if (!tokenData.refresh_token) {
      console.error("No refresh_token received — user may need to re-authorize");
      // Still save with just access token — better than nothing
    }

    // Save to Supabase using insert with ON CONFLICT
    const db = supabaseAdmin();

    const { error: dbError } = await db
      .from("oauth_tokens")
      .upsert({
        provider:      "google",
        access_token:  tokenData.access_token,
        refresh_token: tokenData.refresh_token || "",
        expires_at:    new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        updated_at:    new Date().toISOString(),
      }, { onConflict: "provider" });

    if (dbError) {
      console.error("Supabase save error:", dbError.message);
      return res.redirect(`/dashboard?tab=google&error=${encodeURIComponent("DB error: " + dbError.message)}`);
    }

    console.log("Google OAuth success — token saved");
    return res.redirect("/dashboard?tab=google&connected=true");

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Google OAuth callback exception:", msg);
    return res.redirect(`/dashboard?tab=google&error=${encodeURIComponent(msg)}`);
  }
}
