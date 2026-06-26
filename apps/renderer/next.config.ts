import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tauri requires a static HTML export. 
  // It's best practice to enable this unconditionally so your dev 
  // environment matches your production static build exactly.
  output: "export",

  // ⚠️ REMOVED: assetPrefix: isProd ? "./" : undefined
  // Electron needed this because it uses the raw `file://` protocol. 
  // Tauri serves files securely over a custom local scheme (tauri:// or https://tauri.localhost).
  // Leaving "./" in will actually BREAK asset loading in Tauri.

  // Disable server-side image optimization (Tauri has no Node server to do this)
  images: {
    unoptimized: true,
  },

  // Generates physical folders like `/about/index.html` instead of `about.html`.
  // Recommended for static exports to prevent routing bugs in the webview.
  trailingSlash: true,

  // Replace Electron env variable
  env: {
    IS_TAURI: "true",
  },
};

export default nextConfig;