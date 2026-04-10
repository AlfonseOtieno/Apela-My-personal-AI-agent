import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        // Logged in — go to chat or dashboard based on display mode
        const isStandalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        router.replace(isStandalone ? "/chat" : "/dashboard");
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  return null;
}
