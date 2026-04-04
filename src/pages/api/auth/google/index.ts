import type { NextApiRequest, NextApiResponse } from "next";
import { getGoogleAuthUrl } from "@/lib/google";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}
