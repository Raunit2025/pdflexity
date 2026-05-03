"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronLeft, ChevronRight, Merge, Scissors, ListOrdered,
  ScanLine, PenTool, LockOpen, Shield, FileStack, EyeOff,
  Minimize2, Wrench, ScanSearch, PanelLeftClose, PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ThemeToggle } from "@/components/theme-toggle"

type NavItem  = { label: string; href: string; icon: React.ElementType }
type NavGroup = { title: string; icon: React.ElementType; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    title: "Organize PDF", icon: ListOrdered,
    items: [
      { label: "Merge PDF",    href: "/organize/merge",    icon: Merge       },
      { label: "Split PDF",    href: "/organize/split",    icon: Scissors    },
      { label: "Organize PDF", href: "/organize/organize", icon: ListOrdered },
      { label: "Scan to PDF",  href: "/organize/scan",     icon: ScanLine    },
    ],
  },
  {
    title: "PDF Security", icon: Shield,
    items: [
      { label: "Sign PDF",    href: "/security/sign",    icon: PenTool  },
      { label: "Unlock PDF",  href: "/security/unlock",  icon: LockOpen },
      { label: "Protect PDF", href: "/security/protect", icon: Shield   },
      { label: "Compare PDF", href: "/security/compare", icon: FileStack},
      { label: "Redact PDF",  href: "/security/redact",  icon: EyeOff   },
    ],
  },
  {
    title: "Optimize PDF", icon: Wrench,
    items: [
      { label: "Compress PDF", href: "/optimize/compress", icon: Minimize2  },
      { label: "Repair PDF",   href: "/optimize/repair",   icon: Wrench     },
      { label: "OCR PDF",      href: "/optimize/ocr",      icon: ScanSearch },
    ],
  },
]

function PdflexityLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="7" fill="#10b981" fillOpacity="0.15" />
      <rect x="1" y="1" width="26" height="26" rx="6" stroke="#10b981" strokeOpacity="0.4" strokeWidth="1" />
      <path d="M8 6h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7a1 1 0 011-1z" stroke="#10b981" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
      <path d="M16 6v4h4" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 13h8M10 16h6M10 19h4" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M18 13.5l-2 3h2l-2 3" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <TooltipProvider delay={300}>
      <aside className={cn(
        "relative flex h-screen flex-col transition-all duration-300 ease-in-out",
        "border-r border-sidebar-border",
        "bg-sidebar dark:bg-[linear-gradient(180deg,#0B0F14_0%,#0d1120_50%,#111827_100%)]",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}>
        {/* Green ambient glow */}
        <div
          className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }}
        />

        {/* Electron drag region */}
        <div className="app-drag h-8 w-full shrink-0" />

        {/* Brand Header */}
        <div className={cn("flex shrink-0 items-center px-3 pb-4", collapsed ? "justify-center" : "justify-between")}>
          {/* Logo + title */}
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="shrink-0 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">
              <PdflexityLogo size={28} />
            </div>
            {!collapsed && (
              <span className="truncate text-[15px] font-semibold text-sidebar-foreground" style={{ letterSpacing: "0.06em" }}>
                pdflexity
              </span>
            )}
          </div>

          {/* Always-visible collapse/expand toggle */}
          <Tooltip>
            <TooltipTrigger
              onClick={() => setCollapsed(!collapsed)}
              className="app-no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/40 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed
                ? <PanelLeftOpen  className="h-4 w-4" />
                : <PanelLeftClose className="h-4 w-4" />
              }
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 overflow-hidden px-2">
          <nav className="space-y-0.5 pb-4" aria-label="Main navigation">
            {navGroups.map((group) => (
              <NavGroup key={group.title} group={group} collapsed={collapsed} pathname={pathname} />
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className={cn("shrink-0 border-t border-sidebar-border p-3", collapsed ? "flex flex-col items-center gap-2" : "space-y-2")}>
          <ThemeToggle collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  )
}

function NavGroup({ group, collapsed, pathname }: { group: NavGroup; collapsed: boolean; pathname: string }) {
  const hasActiveChild = group.items.some((item) => pathname === item.href)
  const [open, setOpen] = React.useState(true)
  const GroupIcon = group.icon

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        <div className="mx-2 my-2 h-px bg-sidebar-border" />
        {group.items.map((item) => (
          <NavLeaf key={item.href} item={item} active={pathname === item.href} collapsed />
        ))}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className={cn(
        "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
        hasActiveChild ? "text-[#6ee7b7]" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
      )}>
        <div className="flex items-center gap-2.5">
          <GroupIcon className={cn(
            "h-[15px] w-[15px] shrink-0 transition-colors",
            hasActiveChild ? "text-[#34d399]" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60"
          )} />
          <span className="tracking-[0.01em]">{group.title}</span>
        </div>
        <ChevronRight className={cn("h-3 w-3 shrink-0 text-sidebar-foreground/20 transition-transform duration-200", open && "rotate-90")} />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden">
        <div className="ml-[18px] space-y-px border-l border-sidebar-border/60 pl-3 pt-0.5 pb-1.5">
          {group.items.map((item) => (
            <NavLeaf key={item.href} item={item} active={pathname === item.href} collapsed={false} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function NavLeaf({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon

  const inner = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md text-[13px] transition-all duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[#10b981]/50",
        collapsed ? "h-9 w-9 justify-center mx-auto" : "px-2.5 py-[7px]",
        active
          ? "bg-[#10b981]/12 text-sidebar-foreground"
          : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground/90"
      )}
      style={active && !collapsed ? { boxShadow: "inset 2px 0 0 #10b981" } : undefined}
    >
      {active && (
        <span
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{ background: "radial-gradient(ellipse at 0% 50%, rgba(16,185,129,0.18) 0%, transparent 65%)" }}
        />
      )}
      <Icon className={cn(
        "relative shrink-0 h-[14px] w-[14px] transition-colors duration-150",
        active ? "text-[#34d399]" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/70"
      )} />
      {!collapsed && <span className="relative truncate font-[430]">{item.label}</span>}
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
