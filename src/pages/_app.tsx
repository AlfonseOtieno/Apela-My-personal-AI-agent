import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {

  useEffect(() => {
    // Force service worker update check on every page load
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          reg.update(); // Check for new SW version
        });
      });

      // Listen for new SW — reload page when it takes over
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Apela" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <title>Apela</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
