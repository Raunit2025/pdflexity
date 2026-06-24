import { ipcMain } from "electron";
import { Channels } from "../../constants/channels";
import { goBridge } from "../../services/go-bridge";
import fs from "fs/promises";
import path from "path";
import os from "os";

export function registerSplitHandler(): void {
  ipcMain.handle(
    Channels.PDF_SPLIT,
    async (
      _event,
      buffer: Uint8Array,
      fileName: string,
      pageRanges: string[],
      mergeOutput: boolean
    ) => {
      try {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdflexity-split-"));
        const inputPath = path.join(tempDir, `input_${fileName}`);
        
        await fs.writeFile(inputPath, buffer);

        let outputPath = "";
        
        if (mergeOutput) {
          outputPath = path.join(tempDir, `split_${fileName}`);
        } else {
          // If we are extracting to multiple files, we pass a directory path to the engine
          outputPath = path.join(tempDir, "output");
          await fs.mkdir(outputPath);
        }

        const result = await goBridge.send({
          op: "split",
          inputPath,
          outputPath,
          pageRanges,
          mergeOutput
        });

        if (!result.success) {
          throw new Error(result.error || "Unknown split error");
        }

        if (mergeOutput) {
          // Engine created a single trimmed file
          const outBuffer = await fs.readFile(outputPath);
          
          // Cleanup
          await fs.rm(tempDir, { recursive: true, force: true });
          
          return {
            success: true,
            data: outBuffer.buffer, // Return ArrayBuffer to renderer
            fileName: `split_${fileName}`,
          };
        } else {
          // Engine created multiple extracted files in the outDir
          // Read all extracted files
          const files = await fs.readdir(outputPath);
          const pdfFiles = files.filter(f => f.endsWith(".pdf"));
          
          const extractedBuffers = [];
          for (const f of pdfFiles) {
            const buf = await fs.readFile(path.join(outputPath, f));
            extractedBuffers.push({
              name: f,
              buffer: buf.buffer
            });
          }
          
          // Cleanup
          await fs.rm(tempDir, { recursive: true, force: true });
          
          return {
            success: true,
            data: extractedBuffers, // Array of { name, buffer }
            isMultiple: true
          };
        }
      } catch (error) {
        console.error("IPC PDF split error:", error);
        return { success: false, error: String(error) };
      }
    }
  );
}
