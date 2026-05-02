// ─── Unlock PDF — Shared Types ────────────────────────────────────────────────
// Pure TypeScript only — no JSX, no React imports.
// Renderer-specific UI lives in apps/renderer/src/features/security/unlock/

export type UnlockStep = "idle" | "unlocking" | "success" | "error"

export interface UploadedFile {
  /** The browser File object */
  file: File
  /** Display name */
  name: string
  /** Formatted file size e.g. "2.4 MB" */
  sizeLabel: string
}

export interface UnlockState {
  uploadedFile: UploadedFile | null
  password: string
  showPassword: boolean
  step: UnlockStep
  errorMessage: string | null
  downloadUrl: string | null
}

export interface DropZoneProps {
  onFileSelect: (file: File) => void
  isDragging: boolean
  onDragEnter: () => void
  onDragLeave: () => void
}

export interface FileCardProps {
  uploadedFile: UploadedFile
  onReplace: () => void
}

export interface PasswordInputProps {
  value: string
  onChange: (val: string) => void
  showPassword: boolean
  onToggleShow: () => void
  hasError: boolean
  errorMessage: string | null
  disabled: boolean
  onSubmit: () => void
}

export interface SuccessCardProps {
  fileName: string
  downloadUrl: string
  onReset: () => void
}
