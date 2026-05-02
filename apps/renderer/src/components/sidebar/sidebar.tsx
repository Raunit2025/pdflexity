"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Merge,
  Scissors,
  ListOrdered,
  ScanLine,
  PenTool,
  LockOpen,
  Shield,
  FileStack,
  EyeOff,
  Minimize2,
  Wrench,
  ScanSearch,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ThemeToggle } from "@/components/theme-toggle"

// ─── Types ───────────────────────────────────────────────────────────────────

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
}

type NavGroup = {
  title: string
  icon: React.ElementType
  items: NavItem[]
}

// ─── Nav Config ──────────────────────────────────────────────────────────────

const navGroups: NavGroup[] = [
  {
    title: "Organize PDF",
    icon: ListOrdered,
    items: [
      { label: "Merge PDF",    href: "/organize/merge",    icon: Merge       },
      { label: "Split PDF",    href: "/organize/split",    icon: Scissors    },
      { label: "Organize PDF", href: "/organize/organize", icon: ListOrdered },
      { label: "Scan to PDF",  href: "/organize/scan",     icon: ScanLine    },
    ],
  },
  {
    title: "PDF Security",
    icon: Shield,
    items: [
      { label: "Sign PDF",    href: "/security/sign",    icon: PenTool    },
      { label: "Unlock PDF",  href: "/security/unlock",  icon: LockOpen   },
      { label: "Protect PDF", href: "/security/protect", icon: Shield     },
      { label: "Compare PDF", href: "/security/compare", icon: FileStack  },
      { label: "Redact PDF",  href: "/security/redact",  icon: EyeOff     },
    ],
  },
  {
    title: "Optimize PDF",
    icon: Wrench,
    items: [
      { label: "Compress PDF", href: "/optimize/compress", icon: Minimize2  },
      { label: "Repair PDF",   href: "/optimize/repair",   icon: Wrench     },
      { label: "OCR PDF",      href: "/optimize/ocr",      icon: ScanSearch },
    ],
  },
]

// ─── Logo ─────────────────────────────────────────────────────────────────────

function PdflexityLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="28" height="28" rx="7" fill="#6D5DFC" fillOpacity="0.15" />
      <rect x="1" y="1" width="26" height="26" rx="6" stroke="#6D5DFC" strokeOpacity="0.4" strokeWidth="1" />
      <path
        d="M8 6h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7a1 1 0 011-1z"
        stroke="#6D5DFC"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M16 6v4h4" stroke="#6D5DFC" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 13h8M10 16h6M10 19h4" stroke="#6D5DFC" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M18 13.5l-2 3h2l-2 3" stroke="#a594fd" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Sidebar Root ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <TooltipProvider delay={300}>
      <aside
        className={cn(
          "relative flex h-screen flex-col transition-all duration-300 ease-in-out",
          "border-r border-white/5",
          "bg-[linear-gradient(180deg,#0B0F14_0%,#0d1120_50%,#111827_100%)]",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {/* Purple ambient glow */}
        <div
          className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #6D5DFC 0%, transparent 70%)" }}
        />

        {/* Electron drag region */}
        <div className="app-drag h-8 w-full shrink-0" />

        {/* ── Brand Header ────────────────────────────────────── */}
        <div
          className={cn(
            "flex shrink-0 items-center px-3 pb-4",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="shrink-0 drop-shadow-[0_0_8px_rgba(109,93,252,0.6)]">
              <PdflexityLogo size={28} />
            </div>
            {!collapsed && (
              <span
                className="truncate text-[15px] font-semibold text-foreground"
                style={{ letterSpacing: "0.06em" }}
              >
                pdflexity
              </span>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-white/5 hover:text-gray-300"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* ── Navigation ──────────────────────────────────────── */}
        <ScrollArea className="flex-1 overflow-hidden px-2">
          <nav className="space-y-0.5 pb-4" aria-label="Main navigation">
            {navGroups.map((group) => (
              <NavGroup
                key={group.title}
                group={group}
                collapsed={collapsed}
                pathname={pathname}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* ── Footer: theme toggle ─────────────────────────── */}
        <div
          className={cn(
            "shrink-0 border-t border-white/5 p-3",
            collapsed ? "flex flex-col items-center gap-2" : "space-y-2"
          )}
        >
          {/* Expand button (collapsed only) */}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-white/5 hover:text-gray-300"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Theme toggle */}
          <ThemeToggle collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  )
}

// ─── NavGroup ─────────────────────────────────────────────────────────────────

function NavGroup({
  group,
  collapsed,
  pathname,
}: {
  group: NavGroup
  collapsed: boolean
  pathname: string
}) {
  const hasActiveChild = group.items.some((item) => pathname === item.href)
  const [open, setOpen] = React.useState(true)
  const GroupIcon = group.icon

  // ── Collapsed: just show icons with tooltips ──
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {/* Divider between groups */}
        <div className="mx-2 my-2 h-px bg-white/5" />
        {group.items.map((item) => (
          <NavLeaf
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed
          />
        ))}
      </div>
    )
  }

  // ── Expanded: collapsible group ──
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
          hasActiveChild
            ? "text-[#c4b8fd]"
            : "text-gray-500 hover:text-gray-300"
        )}
      >
        <div className="flex items-center gap-2.5">
          <GroupIcon
            className={cn(
              "h-[15px] w-[15px] shrink-0 transition-colors",
              hasActiveChild ? "text-[#a594fd]" : "text-gray-600 group-hover:text-gray-400"
            )}
          />
          <span className="tracking-[0.01em]">{group.title}</span>
        </div>
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-gray-700 transition-transform duration-200",
            open && "rotate-90"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden">
        <div className="ml-[18px] space-y-px border-l border-white/[0.06] pl-3 pt-0.5 pb-1.5">
          {group.items.map((item) => (
            <NavLeaf
              key={item.href}
              item={item}
              active={pathname === item.href}
              collapsed={false}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── NavLeaf ─────────────────────────────────────────────────────────────────

function NavLeaf({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon

  const inner = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md text-[13px] transition-all duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[#6D5DFC]/50",
        collapsed
          ? "h-9 w-9 justify-center mx-auto"
          : "px-2.5 py-[7px]",
        active
          ? "bg-[#6D5DFC]/12 text-white"
          : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-200"
      )}
      style={
        active && !collapsed
          ? { boxShadow: "inset 2px 0 0 #6D5DFC" }
          : undefined
      }
    >
      {/* Active radial glow */}
      {active && (
        <span
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{
            background:
              "radial-gradient(ellipse at 0% 50%, rgba(109,93,252,0.18) 0%, transparent 65%)",
          }}
        />
      )}

      <Icon
        className={cn(
          "relative shrink-0 h-[14px] w-[14px] transition-colors duration-150",
          active ? "text-[#a594fd]" : "text-gray-600 group-hover:text-gray-300"
        )}
      />
      {!collapsed && (
        <span className="relative truncate font-[430]">{item.label}</span>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger>{inner}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return inner
}
