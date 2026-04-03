/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,        // new service worker takes over immediately
  clientsClaim: true,       // new SW claims all open tabs immediately
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  cacheOnFrontEndNav: false, // don't cache nav — always fetch fresh
  fallbacks: {
    document: "/offline",   // optional offline page
  },
});

module.exports = withPWA({
  reactStrictMode: true,
});
