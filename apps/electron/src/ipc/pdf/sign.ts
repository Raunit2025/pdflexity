import { ipcMain } from "electron"
import * as path from "path"
import * as fs from "fs"
import { randomUUID } from "crypto"
import { Channels } from "../../constants/channels"
import { goBridge } from "../../services/go-bridge"

function getTempDir(): string {
  const tmp = path.join(require("os").tmpdir(), "pdflexity")
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
  return tmp
}

export function registerSignHandlers() {
  ipcMain.handle(Channels.PDF_CERT_INFO, async (_, certPath: string, passphrase: string) => {
    try {
      const resp = await goBridge.send({
        op: "certInfo",
        certPath,
        passphrase,
      })
      if (!resp.success) throw new Error(resp.error || "Failed to parse certificate")
      return { success: true, data: resp.data }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle(Channels.PDF_VERIFY, async (_, pdfBytes: ArrayBuffer) => {
    try {
      const tempId = randomUUID()
      const inputPath = path.join(getTempDir(), `verify_in_${tempId}.pdf`)
      
      fs.writeFileSync(inputPath, Buffer.from(pdfBytes))

      const resp = await goBridge.send({
        op: "verify",
        inputPath,
      })

      // Clean up
      try { fs.unlinkSync(inputPath) } catch (e) {}

      if (!resp.success) throw new Error(resp.error || "Failed to verify signatures")
      return { success: true, data: resp.data }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })

  ipcMain.handle(Channels.PDF_SIGN, async (_, options: any) => {
    try {
      const tempId = randomUUID()
      const inputPath = path.join(getTempDir(), `sign_in_${tempId}.pdf`)
      const outputPath = path.join(getTempDir(), `sign_out_${tempId}.pdf`)

      fs.writeFileSync(inputPath, Buffer.from(options.pdfBytes))

      const resp = await goBridge.send({
        op: "sign",
        inputPath,
        outputPath,
        certPath: options.certPath,
        passphrase: options.passphrase,
        page: options.page,
        zone: options.zone,
        reason: options.reason,
        location: options.location,
        contact: options.contact,
        // @ts-ignore (we know appearance might exist)
        appearance: options.appearance,
      })

      if (!resp.success) {
        // Clean up input
        try { fs.unlinkSync(inputPath) } catch (e) {}
        throw new Error(resp.error || "Failed to sign PDF")
      }

      // Read back the signed bytes
      const signedBytes = fs.readFileSync(outputPath)

      // Clean up temp files
      try {
        fs.unlinkSync(inputPath)
        fs.unlinkSync(outputPath)
      } catch (e) {}

      // Convert back to base64 so it can pass across IPC properly or return base64 string
      const base64Data = signedBytes.toString("base64")

      return {
        success: true,
        data: base64Data,
        fileName: `signed_${options.fileName || "document.pdf"}`
      }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })
}
