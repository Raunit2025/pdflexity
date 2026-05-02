"use client"

import * as React from "react"
import { FileText, Lock, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DropZoneProps } from "../types"

export function DropZone({ onFileSelect, isDragging, onDragEnter, onDragLeave }: DropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    onDragLeave()
    const file = e.dataTransfer.files[0]
    if (file?.type === "application/pdf") onFileSelect(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); onDragEnter() }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative w-full rounded-2xl border-2 border-dashed px-8 py-14",
        "flex flex-col items-center justify-center gap-4",
        "transition-all duration-200 ease-out outline-none",
        "focus-visible:ring-2 focus-visible:ring-[#6D5DFC]/60",
        isDragging
          ? "scale-[1.015] border-[#6D5DFC] bg-[#6D5DFC]/5 shadow-[0_0_40px_rgba(109,93,252,0.15)]"
          : "border-white/10 bg-white/[0.02] hover:border-[#6D5DFC]/50 hover:bg-[#6D5DFC]/[0.03] hover:shadow-[0_0_30px_rgba(109,93,252,0.08)]"
      )}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[#6D5DFC]/5" />
      )}

      {/* Icon */}
      <div className="relative">
        <div className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200",
          "bg-[#6D5DFC]/10 ring-1 ring-[#6D5DFC]/20",
          isDragging && "scale-110 bg-[#6D5DFC]/20 ring-[#6D5DFC]/40",
          "group-hover:bg-[#6D5DFC]/15 group-hover:ring-[#6D5DFC]/30"
        )}>
          <FileText className="h-7 w-7 text-[#a594fd]" />
        </div>
        <div className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background ring-2 ring-[#6D5DFC]/30">
          <Lock className="h-3 w-3 text-[#a594fd]" />
        </div>
      </div>

      {/* Text */}
      <div className="space-y-1 text-center">
        <p className={cn(
          "text-[15px] font-medium transition-colors",
          isDragging ? "text-[#a594fd]" : "text-foreground/80 group-hover:text-foreground"
        )}>
          {isDragging ? "Release to upload" : "Drop your locked PDF here"}
        </p>
        <p className="text-sm text-muted-foreground">
          or <span className="text-[#a594fd]">click to browse</span>
        </p>
      </div>

      <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1">
        <Upload className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground tracking-wide">PDF only</span>
      </div>

      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
    </button>
  )
}
