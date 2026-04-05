/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  cacheOnFrontEndNav: false,
  // Removed fallbacks — /offline page doesn't exist and breaks SW registration
});

module.exports = withPWA({
  reactStrictMode: true,
});
