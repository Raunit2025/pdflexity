// ─── IPC Channel Name Constants ───────────────────────────────────────────────
// Single source of truth — used in both preload and ipc handlers.

export const Channels = {
  // App
  APP_GET_PLATFORM:  "app:get-platform",
  APP_GET_VERSION:   "app:get-version",
  // Shell
  SHELL_OPEN_EXTERNAL: "shell:open-external",
  // PDF operations
  PDF_UNLOCK:  "pdf:unlock",
  PDF_PROTECT: "pdf:protect",
  PDF_COMPARE: "pdf:compare",
  PDF_MERGE:   "pdf:merge",
  PDF_SPLIT:   "pdf:split",
  PDF_SIGN:    "pdf:sign",
  PDF_VERIFY:  "pdf:verify",
  PDF_CERT_INFO: "pdf:cert-info",
} as const

export type ChannelName = (typeof Channels)[keyof typeof Channels]
