import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // If opened from installed PWA, go straight to chat
    // If opened in browser, go to dashboard
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    router.replace(isStandalone ? "/chat" : "/dashboard");
  }, [router]);

  return null;
}
