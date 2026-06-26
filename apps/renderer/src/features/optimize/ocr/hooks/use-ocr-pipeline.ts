"use client"

import { useCallback, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { save } from "@tauri-apps/plugin-dialog"
import { useOcrStore } from "@/stores/use-ocr-store"
import type { OCRProgressEvent, OCRPageResult } from "@/features/optimize/ocr/types"

// Helper to check if we are running inside the native Tauri window
const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Hook that wires the OCR Zustand store to Tauri events.
 * Handles: starting OCR, cancelling, listening for streaming progress,
 * and exporting results.
 */
export function useOcrPipeline() {
  const listenerRegistered = useRef(false)

  // Register Tauri event listeners for streaming progress
  useEffect(() => {
    if (!isTauri()) return // Skip native listeners if running in a normal web browser
    if (listenerRegistered.current) return
    listenerRegistered.current = true

    let unlistenFn: (() => void) | null = null

    listen<string>('ocr-event', (event) => {
      try {
        const data = JSON.parse(event.payload)
        const store = useOcrStore.getState()
        
        if (data.type === 'progress') {
          if (data.status) store.setStep(data.status)
          if (data.currentPage && data.totalPages) {
            store.setProgress(data.currentPage, data.totalPages)
          }
        } else if (data.type === 'page-result') {
          store.addPageResult(data.pageResult as unknown as OCRPageResult)
        } else if (data.type === 'page-image') {
          store.setPageImage(data.pageImage.page, data.pageImage.imageBase64)
        } else if (data.type === 'complete') {
          store.setJobId('job-complete')
          store.setCompletionData(data.overallConfidence ?? 0, data.detectedLanguages ?? [])
        } else if (data.type === 'error') {
          store.setError(data.error || "OCR Error")
          store.setStep("idle")
        }
      } catch (e) {
        console.error("Failed to parse OCR event:", e)
      }
    }).then(unlisten => {
      unlistenFn = unlisten
    })

    return () => {
      if (unlistenFn) unlistenFn()
      listenerRegistered.current = false
    }
  }, [])

  // Start OCR processing
  const startOcr = useCallback(async () => {
    const { uploadedFile, options } = useOcrStore.getState()
    if (!uploadedFile) return

    if (!isTauri()) {
      // Fallback: use mock data for browser development
      await runMockOcr()
      return
    }

    useOcrStore.getState().setStep("uploading")

    try {
      const bytes = Array.from(new Uint8Array(uploadedFile.buffer))
      const inputPath = await invoke<string>('write_temp_file', { bytes })
      const outputDir = await invoke<string>('create_temp_dir')

      const command = {
        op: "ocr-start",
        inputPath,
        outputPath: outputDir,
        languages: options.languages,
        dpi: options.dpi
      }

      await invoke('start_ocr_stream', { commandJson: JSON.stringify(command) })
    } catch (err: any) {
      useOcrStore.getState().setError(err.message || "OCR processing failed")
      useOcrStore.getState().setStep("idle")
    }
  }, [])

  // Cancel OCR
  const cancelOcr = useCallback(async () => {
    if (isTauri()) {
      await invoke('cancel_ocr_stream').catch(console.error)
    }
    useOcrStore.getState().setStep("idle")
  }, [])

  // Export results natively
  const exportResults = useCallback(async (format: string) => {
    const { uploadedFile, pageResults, editedBlocks } = useOcrStore.getState()
    if (!uploadedFile) return

    if (!isTauri()) {
      // Mock export for browser development
      alert(`Export as ${format} — requires Tauri native runtime`)
      return
    }

    try {
      const mimeMap: Record<string, string[]> = {
        "docx": ["docx"],
        "json": ["json"],
        "searchable-pdf": ["pdf"],
        "editable-pdf": ["pdf"],
      }
      
      const savePath = await save({
        title: 'Export OCR Results',
        defaultPath: `exported_document.${mimeMap[format]?.[0] || 'pdf'}`,
        filters: [{ name: format.toUpperCase(), extensions: mimeMap[format] || ['pdf'] }]
      })
      
      if (!savePath) return

      const ocrData = Array.from(pageResults.values())
      const edits: Record<string, any> = {}
      for (const [id, block] of editedBlocks) {
        edits[id] = { text: block.text }
      }

      const bytes = Array.from(new Uint8Array(uploadedFile.buffer))
      const inputPath = await invoke<string>('write_temp_file', { bytes })

      const command = {
        op: "ocr-export",
        inputPath: inputPath,
        outputPath: savePath,
        exportFormat: format,
        ocrData: JSON.stringify(ocrData),
        edits: JSON.stringify(edits)
      }

      const responseStr = await invoke<string>('run_pdf_engine', { 
        commandJson: JSON.stringify(command) 
      })
      const response = JSON.parse(responseStr)

      if (!response.success) throw new Error(response.error ?? "Export failed")

      await invoke('delete_temp_file', { path: inputPath }).catch(() => {})
      
      useOcrStore.getState().setExportUrl("saved-natively")
      
    } catch (err: any) {
      useOcrStore.getState().setError(err.message || "Export failed")
    }
  }, [])

  return { startOcr, cancelOcr, exportResults }
}

/**
 * Mock OCR pipeline for development without Tauri/PaddleOCR.
 * Generates realistic-looking OCR results with simulated delays.
 */
async function runMockOcr() {
  const { uploadedFile } = useOcrStore.getState()
  if (!uploadedFile) return

  const totalPages = 3 // Simulated page count
  const store = useOcrStore.getState()

  // Simulate pipeline stages
  const stages = [
    { step: "uploading" as const, delay: 400 },
    { step: "rendering" as const, delay: 600 },
    { step: "detecting-layout" as const, delay: 800 },
  ]

  for (const { step, delay } of stages) {
    store.setStep(step)
    await sleep(delay)
  }

  for (let page = 1; page <= totalPages; page++) {
    store.setStep("running-ocr")
    store.setProgress(page, totalPages)
    await sleep(500)

    // Generate mock text blocks
    const blocks = generateMockBlocks(page, 612, 792)
    
    const pageResult: OCRPageResult = {
      page,
      width: 612,
      height: 792,
      textBlocks: blocks,
      tables: [],
      images: [],
      language: "en",
      avgConfidence: 0.87 + Math.random() * 0.1,
      processingTimeMs: 800 + Math.random() * 400,
    }

    store.addPageResult(pageResult)
  }

  store.setStep("rebuilding")
  await sleep(400)
  store.setCompletionData(0.91, ["en"])
}

function generateMockBlocks(page: number, pageW: number, pageH: number) {
  const blocks = [
    {
      id: `p${page}-title`,
      text: page === 1 ? "Quarterly Business Report" : page === 2 ? "Financial Analysis" : "Appendix & Notes",
      bbox: { x: 72, y: 60, width: 468, height: 32 },
      confidence: 0.98,
      type: "heading" as const,
      fontSize: 24,
      fontWeight: "bold" as const,
      fontStyle: "normal" as const,
      alignment: "left" as const,
      lineHeight: 33.6,
      color: "#000000",
    },
    {
      id: `p${page}-subtitle`,
      text: page === 1 ? "Q4 2025 — Internal Distribution" : page === 2 ? "Revenue & Growth Metrics" : "Supporting Documentation",
      bbox: { x: 72, y: 100, width: 350, height: 18 },
      confidence: 0.95,
      type: "paragraph" as const,
      fontSize: 14,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "left" as const,
      lineHeight: 19.6,
      color: "#444444",
    },
    {
      id: `p${page}-body1`,
      text: "This document contains confidential information regarding the company's operational performance during the fourth quarter. All metrics presented have been verified by the finance department and approved for internal review. Distribution outside the organization is strictly prohibited without prior written consent.",
      bbox: { x: 72, y: 140, width: 468, height: 52 },
      confidence: 0.92,
      type: "paragraph" as const,
      fontSize: 11,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "justify" as const,
      lineHeight: 15.4,
      color: "#000000",
    },
    {
      id: `p${page}-body2`,
      text: "Key highlights include a 23% year-over-year revenue increase, improved operational efficiency across all departments, and successful completion of the digital transformation initiative. Customer satisfaction scores reached an all-time high of 94.2%, reflecting our commitment to service excellence.",
      bbox: { x: 72, y: 210, width: 468, height: 52 },
      confidence: 0.89,
      type: "paragraph" as const,
      fontSize: 11,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "justify" as const,
      lineHeight: 15.4,
      color: "#000000",
    },
    {
      id: `p${page}-heading2`,
      text: page === 1 ? "Executive Summary" : page === 2 ? "Market Analysis" : "Data Sources",
      bbox: { x: 72, y: 290, width: 300, height: 22 },
      confidence: 0.96,
      type: "heading" as const,
      fontSize: 18,
      fontWeight: "bold" as const,
      fontStyle: "normal" as const,
      alignment: "left" as const,
      lineHeight: 25.2,
      color: "#000000",
    },
    {
      id: `p${page}-body3`,
      text: "The organization demonstrated remarkable resilience in a challenging economic environment. Strategic investments in technology infrastructure and talent development have positioned the company for sustained growth. Our market share expanded by 4.7 percentage points, reaching 31.2% in our primary segment.",
      bbox: { x: 72, y: 330, width: 468, height: 52 },
      confidence: 0.85,
      type: "paragraph" as const,
      fontSize: 11,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "justify" as const,
      lineHeight: 15.4,
      color: "#000000",
    },
    {
      id: `p${page}-list1`,
      text: "• Revenue growth: $142.3M (+23% YoY)",
      bbox: { x: 90, y: 400, width: 350, height: 16 },
      confidence: 0.93,
      type: "list-item" as const,
      fontSize: 11,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "left" as const,
      lineHeight: 15.4,
      color: "#000000",
    },
    {
      id: `p${page}-list2`,
      text: "• Operating margin: 18.4% (+2.1 pp)",
      bbox: { x: 90, y: 420, width: 350, height: 16 },
      confidence: 0.91,
      type: "list-item" as const,
      fontSize: 11,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "left" as const,
      lineHeight: 15.4,
      color: "#000000",
    },
    {
      id: `p${page}-list3`,
      text: "• Customer retention: 96.8% (+1.3 pp)",
      bbox: { x: 90, y: 440, width: 350, height: 16 },
      confidence: 0.72,
      type: "list-item" as const,
      fontSize: 11,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "left" as const,
      lineHeight: 15.4,
      color: "#000000",
    },
    {
      id: `p${page}-body4`,
      text: "Looking ahead to the next fiscal year, management expects continued momentum driven by new product launches and geographic expansion. The board has approved an increased R&D budget to accelerate innovation in artificial intelligence and machine learning capabilities.",
      bbox: { x: 72, y: 480, width: 468, height: 52 },
      confidence: 0.88,
      type: "paragraph" as const,
      fontSize: 11,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "justify" as const,
      lineHeight: 15.4,
      color: "#000000",
    },
    {
      id: `p${page}-footer`,
      text: `Page ${page} of ${3} — Confidential`,
      bbox: { x: 72, y: 750, width: 200, height: 12 },
      confidence: 0.94,
      type: "footer" as const,
      fontSize: 9,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      alignment: "left" as const,
      lineHeight: 12.6,
      color: "#888888",
    },
  ]

  return blocks
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}