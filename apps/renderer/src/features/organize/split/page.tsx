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
        title: 'Save Trimmed PDF',
        defaultPath: `trimmed_${file.name}`,
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
      // Write input file to temp so Rust can read it
      const buffer = await file.arrayBuffer()
      const bytes = Array.from(new Uint8Array(buffer))
      const inputPath = await invoke<string>('write_temp_file', { bytes })
      
      // 2. Map ranges/selected to a flat array of page numbers
      let pagesToProcess: number[] = []
      
      if (mode === "range") {
        ranges.forEach(r => {
          // Convert {from: 1, to: 3} into [1, 2, 3]
          for (let i = r.from; i <= r.to; i++) {
            if (!pagesToProcess.includes(i)) {
              pagesToProcess.push(i)
            }
          }
        })
      } else if (mode === "pages") {
        pagesToProcess = [...selectedPages]
      } else {
        throw new Error("Size mode is not yet implemented.")
      }
      
      if (pagesToProcess.length === 0) {
         throw new Error("No pages selected to extract/trim.")
      }

      // 3. Command Native Rust Engine!
      if (mergeOutput) {
        await invoke('trim_pdf', {
          inputPath: inputPath,
          outputPath: savePath,
          selectedPages: pagesToProcess
        })
      } else {
        await invoke('extract_pages_pdf', {
          inputPath: inputPath,
          outDir: savePath,
          selectedPages: pagesToProcess
        })
      }
      
      // Cleanup input temp file
      await invoke('delete_temp_file', { path: inputPath }).catch(() => {})
      
      // Show success (Files are already magically on their hard drive!)
      setStep("success")
    } catch (err: any) {
      setError(err.message || "Failed to process PDF")
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
          fileName={mergeOutput ? "Trimmed_Document.pdf" : "Extracted_Pages"}
          downloadUrl="#"
          onReset={reset}
          title="Operation Successful"
          description={mergeOutput ? "Your PDF has been trimmed successfully." : "Your pages have been extracted successfully."}
          primaryActionText="Open Folder" // You might want to update this behavior later to open the output folder!
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