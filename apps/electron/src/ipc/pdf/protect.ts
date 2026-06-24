import { ipcMain } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Channels } from "../../constants/channels";
import { goBridge } from "../../services/go-bridge";

/**
 * pdf:protect
 *
 * Receives a PDF file as a Uint8Array buffer + password from the renderer.
 * Saves it to a temp file, calls the Go engine to AES-256 encrypt it,
 * reads back the output, and returns the protected file as a base64 string.
 */
export function registerProtectHandler(): void {
  ipcMain.handle(
    Channels.PDF_PROTECT,
    async (_event, fileBuffer: Uint8Array, password: string, fileName: string) => {
      const tmpDir     = fs.mkdtempSync(path.join(os.tmpdir(), "pdflexity-"));
      const inputPath  = path.join(tmpDir, "input.pdf");
      const outputPath = path.join(tmpDir, "output.pdf");

      try {
        fs.writeFileSync(inputPath, Buffer.from(fileBuffer));

        const result = await goBridge.send({
          op: "protect",
          inputPath,
          outputPath,
          password,
        });

        if (!result.success) {
          throw new Error(result.error ?? "Unknown protect error");
        }

        const protected_ = fs.readFileSync(outputPath);
        return {
          success: true,
          data: protected_.toString("base64"),
          fileName: fileName.replace(/\.pdf$/i, "_protected.pdf"),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch { /* ignore cleanup errors */ }
      }
    }
  );
}
