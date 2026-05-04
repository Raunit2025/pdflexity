"use client"

import * as React from "react"
import { useSignStore } from "@/stores/use-sign-store"
import { Loader2 } from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _lib: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _libPromise: Promise<any> | null = null

async function getPdfjsLib() {
  if (_lib) return _lib
  if (_libPromise) return _libPromise
  _libPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then(lib => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    lib.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.mjs`
    _lib = lib
    return lib
  })
  return _libPromise
}

export function PDFViewer() {
  const store = useSignStore()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!store.pdfBytes) return

    let active = true
    const renderPage = async () => {
      setLoading(true)
      try {
        const pdfjsLib = await getPdfjsLib()
        const loadingTask = pdfjsLib.getDocument({ data: store.pdfBytes })
        const pdf = await loadingTask.promise
        if (!active) return

        if (store.totalPages === 0) {
          store.setTotalPages(pdf.numPages)
        }

        const page = await pdf.getPage(store.currentPage)
        if (!active) return

        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext("2d")
        if (!context) return

        // Calculate scale to fit container width (simple approach, usually you want zooming)
        const containerWidth = containerRef.current?.clientWidth || 800
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        // const scale = Math.min((containerWidth - 64) / unscaledViewport.width, 2.0)
        const scale = 1.0 // keep simple for testing signature coords
        
        const viewport = page.getViewport({ scale })

        canvas.width = viewport.width * window.devicePixelRatio
        canvas.height = viewport.height * window.devicePixelRatio
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: [window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0],
        }

        await page.render(renderContext).promise
      } catch (err) {
        console.error("Failed to render PDF:", err)
      } finally {
        if (active) setLoading(false)
      }
    }

    renderPage()

    return () => {
      active = false
    }
  }, [store.pdfBytes, store.currentPage])

  if (!store.pdfBytes) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground/50 border border-dashed rounded-xl bg-muted/10">
        Open a PDF to start
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative flex flex-1 flex-col items-center justify-center overflow-auto bg-background/50 p-8 rounded-xl ring-1 ring-border/50">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div className="relative shadow-2xl ring-1 ring-border/50 bg-white">
        <canvas ref={canvasRef} className="block max-w-full" />
        
        <SignatureOverlay />
      </div>
    </div>
  )
}

import { Rnd } from "react-rnd"

function SignatureOverlay() {
  const store = useSignStore()

  if (!store.signatureZone || store.signatureZone.page !== store.currentPage) return null

  return (
    <Rnd
      className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/20 flex items-center justify-center group"
      size={{ width: store.signatureZone.width, height: store.signatureZone.height }}
      position={{ x: store.signatureZone.x, y: store.signatureZone.y }}
      onDragStop={(e, d) => {
        store.setSignatureZone({ ...store.signatureZone!, x: d.x, y: d.y })
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        store.setSignatureZone({
          ...store.signatureZone!,
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          ...position
        })
      }}
      bounds="parent"
    >
      <span className="text-indigo-700 dark:text-indigo-300 font-medium text-sm px-2 text-center pointer-events-none select-none">
        Signature Zone
      </span>
      <div className="absolute -top-3 -right-3 hidden group-hover:flex h-6 w-6 items-center justify-center bg-indigo-500 text-white rounded-full cursor-pointer shadow-sm"
           onClick={(e) => {
             e.stopPropagation()
             store.setSignatureZone(null)
           }}>
        ×
      </div>
    </Rnd>
  )
}
