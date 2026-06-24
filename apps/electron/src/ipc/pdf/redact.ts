import { ipcMain } from "electron"
import * as path from "path"
import * as fs from "fs"
import { randomUUID } from "crypto"
import { Channels } from "../../constants/channels"
import { goBridge } from "../../services/go-bridge"

interface RedactionMark {
  page: number
  x: number
  y: number
  width: number
  height: number
  fillColor?: string
  label?: string
  labelColor?: string
}

interface RedactionInfo {
  pageCount: number
  pages: { page: number; width: number; height: number }[]
}

interface SearchMatch {
  page: number
  text: string
  x: number
  y: number
  width: number
  height: number
}

interface SearchResult {
  matches: SearchMatch[]
  total: number
}

interface PreviewResult {
  imageBase64: string
  width: number
  height: number
}

interface RedactResult {
  marksApplied: number
  pagesAffected: number[]
}

function getTempDir(): string {
  const tmp = path.join(require("os").tmpdir(), "pdflexity-redact")
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
  return tmp
}

export function registerRedactHandlers() {
  // Get PDF info (page count and dimensions)
  ipcMain.handle(Channels.PDF_REDACT_INFO, async (_, pdfBuffer: ArrayBuffer) => {
    try {
      const tempId = randomUUID()
      const inputPath = path.join(getTempDir(), `info_${tempId}.pdf`)
      fs.writeFileSync(inputPath, Buffer.from(pdfBuffer))

      const resp = await goBridge.send({ op: "redactInfo", inputPath })
      try { fs.unlinkSync(inputPath) } catch (e) { /* ignore */ }

      if (!resp.success) throw new Error(resp.error || "Failed to get PDF info")
      return { success: true, data: resp.data as RedactionInfo }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  // Search text in PDF
  ipcMain.handle(
    Channels.PDF_REDACT_SEARCH,
    async (
      _: Electron.IpcMainInvokeEvent,
      pdfBuffer: ArrayBuffer,
      query: string,
      caseSensitive: boolean = false,
      regex: boolean = false
    ) => {
      try {
        const tempId = randomUUID()
        const inputPath = path.join(getTempDir(), `search_${tempId}.pdf`)
        fs.writeFileSync(inputPath, Buffer.from(pdfBuffer))

        const resp = await goBridge.send({
          op: "redactSearch",
          inputPath,
          query,
          caseSensitive,
          regex,
        })
        try { fs.unlinkSync(inputPath) } catch (e) { /* ignore */ }

        if (!resp.success) throw new Error(resp.error || "Failed to search PDF")
        return { success: true, data: resp.data as SearchResult }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    }
  )

  // Generate preview with redaction marks
  ipcMain.handle(
    Channels.PDF_REDACT_PREVIEW,
    async (
      _: Electron.IpcMainInvokeEvent,
      pdfBuffer: ArrayBuffer,
      page: number,
      scale: number = 1.5,
      marks: RedactionMark[] = []
    ) => {
      try {
        const tempId = randomUUID()
        const inputPath = path.join(getTempDir(), `preview_${tempId}.pdf`)
        fs.writeFileSync(inputPath, Buffer.from(pdfBuffer))

        const resp = await goBridge.send({
          op: "redactPreview",
          inputPath,
          page,
          scale,
          marks,
        })
        try { fs.unlinkSync(inputPath) } catch (e) { /* ignore */ }

        if (!resp.success) throw new Error(resp.error || "Failed to generate preview")
        return { success: true, data: resp.data as PreviewResult }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    }
  )

  // Apply permanent redaction
  ipcMain.handle(
    Channels.PDF_REDACT,
    async (
      _: Electron.IpcMainInvokeEvent,
      pdfBuffer: ArrayBuffer,
      fileName: string,
      marks: RedactionMark[],
      outputPath?: string
    ) => {
      try {
        const tempId = randomUUID()
        const inputPath = path.join(getTempDir(), `in_${tempId}.pdf`)
        const outPath = outputPath || path.join(getTempDir(), `redacted_${tempId}.pdf`)

        fs.writeFileSync(inputPath, Buffer.from(pdfBuffer))

        const resp = await goBridge.send({
          op: "redact",
          inputPath,
          outputPath: outPath,
          marks,
        })

        if (!resp.success) {
          try { fs.unlinkSync(inputPath) } catch (e) { /* ignore */ }
          throw new Error(resp.error || "Failed to redact PDF")
        }

        // Read the redacted PDF
        const redactedBytes = fs.readFileSync(outPath)

        // Cleanup
        try {
          fs.unlinkSync(inputPath)
          fs.unlinkSync(outPath)
        } catch (e) { /* ignore */ }

        const resultData = resp.data as { marksApplied?: number; pagesAffected?: number[] }

        return {
          success: true,
          data: redactedBytes.toString("base64"),
          fileName: `redacted_${fileName}`,
          marksApplied: resultData?.marksApplied || marks.length,
          pagesAffected: resultData?.pagesAffected || [],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    }
  )
}
