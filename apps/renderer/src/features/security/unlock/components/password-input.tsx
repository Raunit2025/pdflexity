"use client"

import * as React from "react"
import { Eye, EyeOff, AlertCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PasswordInputProps } from "../types"

export function PasswordInput({
  value, onChange, showPassword, onToggleShow,
  hasError, errorMessage, disabled, onSubmit,
}: PasswordInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [capsLock, setCapsLock] = React.useState(false)

  React.useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/80" htmlFor="pdf-password">
        Password
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id="pdf-password"
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            setCapsLock(e.getModifierState("CapsLock"))
            if (e.key === "Enter" && value.trim()) onSubmit()
          }}
          disabled={disabled}
          placeholder="Enter PDF password"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={hasError}
          aria-describedby={hasError ? "password-error" : undefined}
          className={cn(
            "w-full rounded-xl border bg-white/[0.04] px-4 py-3 pr-12",
            "text-sm text-foreground placeholder:text-muted-foreground/50",
            "outline-none transition-all duration-150",
            "focus:bg-white/[0.06] focus:ring-2",
            disabled && "cursor-not-allowed opacity-50",
            hasError
              ? "border-red-500/60 ring-2 ring-red-500/20 [animation:shake_0.4s_ease-in-out]"
              : "border-white/10 focus:border-[#6D5DFC]/60 focus:ring-[#6D5DFC]/20"
          )}
        />
        <button
          type="button"
          onClick={onToggleShow}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {capsLock && !hasError && (
        <div className="flex items-center gap-1.5 text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-xs">Caps Lock is on</span>
        </div>
      )}

      {hasError && errorMessage && (
        <div id="password-error" role="alert" className="flex items-center gap-1.5 text-red-400 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">{errorMessage}</span>
        </div>
      )}
    </div>
  )
}
