"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const themes = [
  { key: "light",  Icon: Sun,     label: "Light" },
  { key: "dark",   Icon: Moon,    label: "Dark"  },
  { key: "system", Icon: Monitor, label: "System"},
] as const

// ─── Inline pill toggler (3 buttons) ────────────────────────────────────────
export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch — only render after mount
  React.useEffect(() => setMounted(true), [])

  if (!mounted) return null

  // Collapsed sidebar: show only the current theme icon with tooltip
  if (collapsed) {
    const current = themes.find((t) => t.key === theme) ?? themes[1]
    const next    = themes[(themes.findIndex((t) => t.key === theme) + 1) % themes.length]
    return (
      <Tooltip>
        <TooltipTrigger>
          <button
            onClick={() => setTheme(next.key)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
            aria-label={`Switch to ${next.label}`}
          >
            <current.Icon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Theme: {current.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  // Expanded sidebar: pill with 3 options
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5"
      role="group"
      aria-label="Theme selector"
    >
      {themes.map(({ key, Icon, label }) => {
        const active = theme === key
        return (
          <Tooltip key={key}>
            <TooltipTrigger>
              <button
                onClick={() => setTheme(key)}
                aria-label={`${label} theme`}
                aria-pressed={active}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150",
                  active
                    ? "bg-[#6D5DFC]/20 text-[#a594fd] shadow-[0_0_0_1px_rgba(109,93,252,0.3)]"
                    : "text-gray-600 hover:text-gray-400"
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span>{label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{label} theme</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
