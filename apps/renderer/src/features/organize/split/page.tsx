"use client"

import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import { useSplitStore } from "@/stores/use-split-store"
import { DropZone } from "./components/drop-zone"
import { PreviewCanvas } from "./components/preview-canvas"
import { ControlPanel } from "./components/control-panel"
import { SuccessCard } from "../merge/components/success-card"
import { save, open } from "@tauri-apps/plugin-dialog"

export function SplitPage() {
  const step = useSplitStore(state => state.step)
  const setStep = useSplitStore(state => state.setStep)
  const setFile = useSplitStore(state => state.setFile)
  const reset = useSplitStore(state => state.reset)

  const setError = useSplitStore(state => state.setError)
  const mode = useSplitStore(state => state.mode)
  const ranges = useSplitStore(state => state.ranges)
  const selectedPages = useSplitStore(state => state.selectedPages)
  const mergeOutput = useSplitStore(state => state.mergeOutput)
  const file = useSplitStore(state => state.file)

  const handleSplit = async () => {
    if (!file) return
    
    let savePath = ""

    // 1. Prompt Native Dialog based on output type
    if (mergeOutput) {
      // Asking for a single file save location
      const result = await save({
        title: 'Save Split PDF',
        defaultPath: `split_${file.name}`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      })
      if (!result) return // User cancelled
      savePath = result
    } else {
      // Asking for a FOLDER to dump multiple extracted pages into
      const result = await open({
        title: 'Select Folder for Extracted Pages',
        directory: true,   // <--- Lets user pick a folder natively
        multiple: false
      })
      if (!result) return // User cancelled
      savePath = result as string
    }

    setStep("processing")
    setError(null)
    
    try {
      const buffer = await file.arrayBuffer()
      const bytes = Array.from(new Uint8Array(buffer))
      
      let pageRanges: string[] = []
      if (mode === "range") {
        pageRanges = ranges.map(r => r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`)
      } else if (mode === "pages") {
        pageRanges = selectedPages.map(p => `${p}`)
      } else {
        throw new Error("Size mode is not yet implemented.")
      }
      
      // Write input file to temp
      const inputPath = await invoke<string>('write_temp_file', { bytes })

      // 2. Command Go Engine to write DIRECTLY to the user's chosen path/folder!
      const command = {
        op: "split",
        inputPath: inputPath,
        outputPath: savePath, // <--- Direct Save!
        pageRanges: pageRanges,
        mergeOutput: mergeOutput
      }

      const responseStr = await invoke<string>('run_pdf_engine', { 
        commandJson: JSON.stringify(command) 
      })
      const response = JSON.parse(responseStr)

      if (!response.success) {
        throw new Error(response.error ?? "Split failed")
      }
      
      // Cleanup input temp file
      await invoke('delete_temp_file', { path: inputPath }).catch(() => {})
      
      // Show success (Files are already magically on their hard drive!)
      setStep("success")
    } catch (err: any) {
      setError(err.message || "Failed to split PDF")
      setStep("split")
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <DropZone onFile={setFile} />
      </div>
    )
  }

  if (step === "success") {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <SuccessCard
          fileName="Split_Documents.pdf"
          downloadUrl="#"
          onReset={reset}
          title="Split Successfully"
          description="Your PDF file has been successfully split."
          primaryActionText="Save Split PDF"
          secondaryActionText="Split More"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      <div className="flex shrink-0 items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Split PDF</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extract pages, split by range, or split by file size.
          </p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden items-stretch">
        <PreviewCanvas />
        <ControlPanel onSplit={handleSplit} />
      </div>
    </div>
  )
}