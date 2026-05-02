"use client"

import * as React from "react"
import { HelpCircle, Lock, Loader2, LockOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import type { UnlockState, UploadedFile } from "./types"
import { DropZone }      from "./components/drop-zone"
import { FileCard }      from "./components/file-card"
import { PasswordInput } from "./components/password-input"
import { SuccessCard }   from "./components/success-card"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const INITIAL: UnlockState = {
  uploadedFile: null,
  password: "",
  showPassword: false,
  step: "idle",
  errorMessage: null,
  downloadUrl: null,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UnlockPdfPage() {
  const [state, setState] = React.useState<UnlockState>(INITIAL)
  const [isDragging, setIsDragging] = React.useState(false)

  const patch = (p: Partial<UnlockState>) => setState((s) => ({ ...s, ...p }))

  // ── File ──────────────────────────────────────────────────────────────────

  function handleFileSelect(file: File) {
    const uploadedFile: UploadedFile = { file, name: file.name, sizeLabel: formatBytes(file.size) }
    patch({ uploadedFile, errorMessage: null, step: "idle", downloadUrl: null })
  }

  // ── Unlock ────────────────────────────────────────────────────────────────

  async function handleUnlock() {
    if (!state.uploadedFile || !state.password.trim()) return
    patch({ step: "unlocking", errorMessage: null })

    try {
      /**
       * TODO: Replace simulation with real pdf-lib unlock.
       * In Electron: ipcRenderer.invoke("pdf:unlock", filePath, password)
       */
      await new Promise((res) => setTimeout(res, 1800))

      const blob = new Blob([await state.uploadedFile.file.arrayBuffer()], { type: "application/pdf" })
      patch({ step: "success", downloadUrl: URL.createObjectURL(blob) })
    } catch {
      patch({ step: "error", errorMessage: "Incorrect password. Please try again." })
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const isLoading = state.step === "unlocking"
  const isSuccess = state.step === "success"
  const hasError  = state.step === "error"
  const canUnlock = !!state.uploadedFile && state.password.trim().length > 0 && !isLoading

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-full flex-col overflow-y-auto">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex shrink-0 items-start justify-between border-b border-white/5 px-8 py-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6D5DFC]/15 ring-1 ring-[#6D5DFC]/25">
                <LockOpen className="h-4 w-4 text-[#a594fd]" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Unlock PDF</h1>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Remove password protection from your PDF securely
            </p>
          </div>

          <Tooltip>
            <TooltipTrigger>
              <div className="flex h-8 w-8 cursor-default items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
                <HelpCircle className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[200px] text-center text-xs">
              Your file is processed <strong>locally</strong> and never uploaded to any server.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ── Main ────────────────────────────────────────────── */}
        <div className="flex flex-1 items-start justify-center px-8 py-10">
          <div className="w-full max-w-[560px] space-y-5">

            {isSuccess && state.downloadUrl ? (
              <SuccessCard
                fileName={state.uploadedFile?.name ?? "unlocked.pdf"}
                downloadUrl={state.downloadUrl}
                onReset={() => setState(INITIAL)}
              />
            ) : (
              <>
                {/* Step 1 */}
                <div className="space-y-2">
                  <StepLabel n={1} text="Upload your locked PDF" />
                  {state.uploadedFile ? (
                    <FileCard
                      uploadedFile={state.uploadedFile}
                      onReplace={() => patch({ uploadedFile: null, password: "", errorMessage: null, step: "idle", downloadUrl: null })}
                    />
                  ) : (
                    <DropZone
                      onFileSelect={handleFileSelect}
                      isDragging={isDragging}
                      onDragEnter={() => setIsDragging(true)}
                      onDragLeave={() => setIsDragging(false)}
                    />
                  )}
                </div>

                {/* Step 2 */}
                <div className={cn("space-y-2 transition-opacity duration-200", !state.uploadedFile && "pointer-events-none opacity-40")}>
                  <StepLabel n={2} text="Enter the PDF password" />
                  <PasswordInput
                    value={state.password}
                    onChange={(val) => patch({ password: val, errorMessage: null, step: "idle" })}
                    showPassword={state.showPassword}
                    onToggleShow={() => patch({ showPassword: !state.showPassword })}
                    hasError={hasError}
                    errorMessage={state.errorMessage}
                    disabled={isLoading || !state.uploadedFile}
                    onSubmit={handleUnlock}
                  />
                </div>

                {/* Step 3 */}
                <div className="space-y-3 pt-1">
                  <button
                    onClick={handleUnlock}
                    disabled={!canUnlock}
                    className={cn(
                      "relative w-full rounded-xl px-6 py-3.5 text-sm font-semibold text-white",
                      "transition-all duration-150 outline-none",
                      "focus-visible:ring-2 focus-visible:ring-[#6D5DFC]/60",
                      canUnlock
                        ? "bg-[#6D5DFC] hover:bg-[#5b4ce0] hover:shadow-[0_0_24px_rgba(109,93,252,0.4)] active:scale-[0.99]"
                        : "cursor-not-allowed bg-white/8 text-white/30"
                    )}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Unlocking…
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Lock className="h-4 w-4" />
                        Unlock PDF
                      </span>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-muted-foreground/60">
                    🔒 Your file is processed locally and never uploaded to any server
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// ─── Step Label ───────────────────────────────────────────────────────────────

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6D5DFC]/15 ring-1 ring-[#6D5DFC]/25 text-[10px] font-bold text-[#a594fd]">
        {n}
      </div>
      <span className="text-[13px] font-medium text-muted-foreground">{text}</span>
    </div>
  )
}
