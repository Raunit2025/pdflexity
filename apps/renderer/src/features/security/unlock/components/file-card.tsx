"use client"

import { FileText, Lock, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FileCardProps } from "../types"

export function FileCard({ uploadedFile, onReplace }: FileCardProps) {
  return (
    <div className={cn(
      "flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4",
      "animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
    )}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6D5DFC]/10 ring-1 ring-[#6D5DFC]/20">
        <FileText className="h-5 w-5 text-[#a594fd]" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{uploadedFile.name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{uploadedFile.sizeLabel}</span>
          <span className="text-muted-foreground/40">·</span>
          <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 ring-1 ring-amber-500/20">
            <Lock className="h-2.5 w-2.5 text-amber-400" />
            <span className="text-[10px] font-medium text-amber-400">Locked</span>
          </div>
        </div>
      </div>

      <button
        onClick={onReplace}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        aria-label="Remove file"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
