"use client"

import * as React from "react"
import { Merge, ShieldCheck, AlertCircle, Loader2 } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"

import type { MergeState, MergeFile } from "./types"
import { DropZone } from "./components/drop-zone"
import { FileList } from "./components/file-list"
import { SuccessCard } from "./components/success-card"
import { save } from "@tauri-apps/plugin-dialog"

import { useMergeStore } from "@/stores/use-merge-store"

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

export default function MergePdfPage() {
  const store = useMergeStore()

  function handleFilesAdded(newFiles: File[]) {
    const wrappedFiles: MergeFile[] = newFiles.map(f => ({
      id: generateId(),
      file: f
    }))
    store.addFiles(wrappedFiles)
  }

  function handleRemoveFile(id: string) {
    store.removeFile(id)
  }

  function handleReorder(newFiles: MergeFile[]) {
    store.reorderFiles(newFiles)
  }

  function reset() {
    store.reset()
  }

  async function runMerge() {
    if (store.files.length < 2) {
      store.setError("Please select at least two PDF files to merge.")
      return
    }

    // 1. Prompt Native 'Save As' Dialog FIRST
    const savePath = await save({
      title: 'Save Merged PDF',
      defaultPath: 'merged_document.pdf',
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    })

    // If user clicks "Cancel" on the dialog, safely abort
    if (!savePath) return

    store.setStep("loading")
    const inputPaths: string[] = []

    try {
      for (const f of store.files) {
        const buffer = await f.file.arrayBuffer()
        const bytes = Array.from(new Uint8Array(buffer))
        const path = await invoke<string>('write_temp_file', { bytes })
        inputPaths.push(path)
      }

      // 2. Command Go engine to write DIRECTLY to the user's chosen path!
      const command = {
        op: "merge",
        inputPaths: inputPaths,
        outputPath: savePath // <--- Direct Save! No temp output path needed.
      }

      const responseStr = await invoke<string>('run_pdf_engine', { 
        commandJson: JSON.stringify(command) 
      })
      const response = JSON.parse(responseStr)

      if (!response.success) {
        throw new Error(response.error ?? "Merge failed")
      }

      // Cleanup input temp files
      for (const path of inputPaths) {
        await invoke('delete_temp_file', { path }).catch(() => {})
      }

      // File is already saved natively, just update the UI to success!
      store.setResult(savePath, "merged_document.pdf")

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      store.setError(msg)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col p-8 pb-4">
      <div className="mb-6 shrink-0 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          <Merge className="h-8 w-8 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Merge PDF Files</h1>
        <p className="mt-2 text-[15px] text-muted-foreground/70">
          Combine multiple PDFs into a single document. Drag cards to reorder.
        </p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {store.step === "success" && store.downloadUrl && store.fileName ? (
          <SuccessCard
            fileName={store.fileName}
            downloadUrl={store.downloadUrl}
            onReset={reset}
          />
        ) : (
          <div className="flex flex-1 flex-col min-h-0 space-y-6">
            {store.files.length === 0 ? (
              <DropZone onFiles={handleFilesAdded} />
            ) : (
              <div className="flex flex-1 flex-col gap-6 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex-1 min-h-0">
                  <FileList
                    files={store.files}
                    onReorder={handleReorder}
                    onRemove={handleRemoveFile}
                    onAddMore={handleFilesAdded}
                  />
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-border/50 pt-4 pb-2">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/60">
                    <ShieldCheck className="h-4 w-4 text-emerald-500/70" />
                    Processed locally on your device
                  </div>

                  <button
                    onClick={runMerge}
                    disabled={store.step === "loading" || store.files.length < 2}
                    className="group relative overflow-hidden rounded-xl bg-emerald-500 px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 hover:shadow-emerald-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative flex items-center justify-center gap-2">
                      {store.step === "loading" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Merging PDFs...
                        </>
                      ) : (
                        <>
                          <Merge className="h-4 w-4" />
                          Merge {store.files.length} files
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {(store.errorMessage || (store.files.length === 1 && store.step !== "success")) && (
              <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 animate-in fade-in duration-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {store.errorMessage || "Please add at least one more PDF file to merge."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}