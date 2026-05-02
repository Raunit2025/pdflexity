"use client"

import { Download, RotateCcw, UnlockKeyhole } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SuccessCardProps } from "../types"

export function SuccessCard({ fileName, downloadUrl, onReset }: SuccessCardProps) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-6 rounded-2xl border border-green-500/15",
      "bg-green-500/[0.04] px-8 py-10 text-center",
      "animate-in fade-in-0 zoom-in-95 duration-400"
    )}>
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 ring-2 ring-green-500/25">
          <UnlockKeyhole className="h-7 w-7 text-green-400" />
        </div>
        <div className="absolute inset-0 rounded-full bg-green-500/10 blur-md" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[17px] font-semibold text-foreground">PDF Unlocked Successfully</h3>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/70">{fileName}</span> is ready to download
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        <a
          href={downloadUrl}
          download={fileName.replace(".pdf", "_unlocked.pdf")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl px-5 py-3",
            "bg-[#6D5DFC] text-white text-sm font-semibold",
            "transition-all duration-150",
            "hover:bg-[#5b4ce0] hover:shadow-[0_0_20px_rgba(109,93,252,0.35)]",
            "active:scale-[0.98]"
          )}
        >
          <Download className="h-4 w-4" />
          Download Unlocked PDF
        </a>

        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Unlock another file
        </button>
      </div>
    </div>
  )
}
