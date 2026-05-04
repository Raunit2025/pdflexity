"use client"

import * as React from "react"
import { PDFViewer } from "./components/pdf-viewer"
import { DocumentPanel, CertificatePanel, SignaturePanel } from "./components/sidebar-panels"
import { VerifyPanel } from "./components/verify-panel"
import { SignToolbar } from "./components/toolbar"
import { useSignStore } from "@/stores/use-sign-store"
import { SuccessCard } from "@/features/security/protect/components/success-card"

export function SignPage() {
  const store = useSignStore()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <SignToolbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[320px] shrink-0 border-r border-border/50 bg-background/30 flex flex-col overflow-y-auto">
           <DocumentPanel />
           <CertificatePanel />
           <SignaturePanel />
           <VerifyPanel />
        </div>

        {/* Main Canvas */}
        <div className="flex-1 bg-muted/10 relative overflow-hidden flex flex-col">
           {store.step === "success" && store.downloadUrl ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 backdrop-blur-sm">
                 <SuccessCard 
                   fileName={store.downloadName || "signed_document.pdf"}
                   downloadUrl={store.downloadUrl}
                   onReset={() => store.reset()}
                 />
              </div>
           ) : null}

           {/* Toolbar for Canvas controls (Zoom, Pagination) */}
           {store.pdfFile && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 px-4 py-2 bg-background/80 backdrop-blur border border-border/50 rounded-full shadow-lg">
                 <button 
                    disabled={store.currentPage <= 1}
                    onClick={() => store.setCurrentPage(store.currentPage - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted disabled:opacity-50">
                    ←
                 </button>
                 <span className="text-xs font-medium">Page {store.currentPage} of {store.totalPages}</span>
                 <button 
                    disabled={store.currentPage >= store.totalPages}
                    onClick={() => store.setCurrentPage(store.currentPage + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted disabled:opacity-50">
                    →
                 </button>
              </div>
           )}

           <PDFViewer />
        </div>
      </div>
    </div>
  )
}
