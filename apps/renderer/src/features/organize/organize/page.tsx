"use client"

import * as React from "react"
import { DndContext, DragEndEvent, DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"

import { OrganizeState, UploadedFile, PdfPage, FILE_COLORS } from "./types"
import { DropZone } from "./components/drop-zone"
import { MainCanvas } from "./components/main-canvas"
import { FileStack } from "./components/file-stack"
import { ActionControls } from "./components/action-controls"
import { ThumbnailGenerator } from "./components/thumbnail-generator"
import { SuccessCard } from "../merge/components/success-card" // Reusing success card

export function OrganizePage() {
  const [state, setState] = React.useState<OrganizeState>({
    step: "upload",
    files: [],
    pages: [],
    errorMessage: null,
  })

  const [activeId, setActiveId] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const handleFiles = async (newFiles: File[]) => {
    setState(prev => {
      const nextFiles = [...prev.files]
      const nextPages = [...prev.pages]

      newFiles.forEach(file => {
        const fileId = crypto.randomUUID()
        const color = FILE_COLORS[nextFiles.length % FILE_COLORS.length]
        
        nextFiles.push({
          id: fileId,
          name: file.name,
          color,
          file,
          numPages: 0 // Will be updated by ThumbnailGenerator when loaded
        })
      })

      return {
        ...prev,
        step: "organize",
        files: nextFiles,
        pages: nextPages,
        errorMessage: null
      }
    })
  }

  const handlePagesExtracted = (fileId: string, thumbnails: string[]) => {
    setState(prev => {
      // First check if this file still exists (might have been deleted while loading)
      const fileExists = prev.files.some(f => f.id === fileId)
      if (!fileExists) return prev

      const newPages: PdfPage[] = thumbnails.map((thumb, i) => ({
        id: `${fileId}-p${i + 1}`,
        fileId,
        pageNumber: i + 1,
        previewUrl: thumb,
        rotation: 0
      }))

      // Update the numPages in the file object
      const nextFiles = prev.files.map(f => f.id === fileId ? { ...f, numPages: thumbnails.length } : f)

      return {
        ...prev,
        files: nextFiles,
        pages: [...prev.pages, ...newPages]
      }
    })
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const activeType = active.data.current?.type
    
    if (activeType === "Page") {
      const oldIndex = state.pages.findIndex(p => p.id === active.id)
      const newIndex = state.pages.findIndex(p => p.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        setState(prev => ({ ...prev, pages: arrayMove(prev.pages, oldIndex, newIndex) }))
      }
    } else if (activeType === "File") {
      const activeFileId = (active.id as string).replace("file-", "")
      const overFileId = (over.id as string).replace("file-", "")
      
      const oldIndex = state.files.findIndex(f => f.id === activeFileId)
      const newIndex = state.files.findIndex(f => f.id === overFileId)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const nextFiles = arrayMove(state.files, oldIndex, newIndex)
        // Reorder pages to match the new file order
        const newPagesOrder: PdfPage[] = []
        nextFiles.forEach(file => {
          const filePages = state.pages.filter(p => p.fileId === file.id)
          // Keep internal ordering of pages within the file
          newPagesOrder.push(...filePages)
        })

        setState(prev => ({ ...prev, files: nextFiles, pages: newPagesOrder }))
      }
    }
  }

  const handleRotatePage = (pageId: string) => {
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === pageId ? { ...p, rotation: ((p.rotation || 0) + 90) % 360 } : p)
    }))
  }

  const handleAddBlankPage = (afterId: string) => {
    setState(prev => {
      const pages = [...prev.pages]
      const index = pages.findIndex(p => p.id === afterId)
      if (index === -1) return prev
      
      const blankPage: PdfPage = {
        id: `blank-${crypto.randomUUID()}`,
        fileId: 'blank',
        pageNumber: 0,
        rotation: 0,
        isBlank: true
      }
      
      pages.splice(index + 1, 0, blankPage)
      return { ...prev, pages }
    })
  }

  const handleDeletePage = (pageId: string) => {
    setState(prev => ({
      ...prev,
      pages: prev.pages.filter(p => p.id !== pageId)
    }))
  }

  const handleDeleteFile = (fileId: string) => {
    setState(prev => {
      const nextFiles = prev.files.filter(f => f.id !== fileId)
      const nextPages = prev.pages.filter(p => p.fileId !== fileId)
      return {
        ...prev,
        files: nextFiles,
        pages: nextPages,
        step: nextFiles.length === 0 ? "upload" : prev.step
      }
    })
  }

  const handleSortAZ = () => {
    setState(prev => {
      const sortedFiles = [...prev.files].sort((a, b) => a.name.localeCompare(b.name))
      const sortedPages: PdfPage[] = []
      sortedFiles.forEach(file => {
        sortedPages.push(...prev.pages.filter(p => p.fileId === file.id))
      })
      return { ...prev, files: sortedFiles, pages: sortedPages }
    })
  }

  const handleSort19 = () => {
    setState(prev => {
      const sortedFiles = [...prev.files].sort((a, b) => a.numPages - b.numPages)
      const sortedPages: PdfPage[] = []
      sortedFiles.forEach(file => {
        sortedPages.push(...prev.pages.filter(p => p.fileId === file.id))
      })
      return { ...prev, files: sortedFiles, pages: sortedPages }
    })
  }

  const handleExport = async () => {
    // Implement actual export using IPC / Go backend later
    setState(prev => ({ ...prev, step: "processing" }))
    setTimeout(() => {
      setState(prev => ({ ...prev, step: "success" }))
    }, 1500)
  }

  const reset = () => {
    setState({ step: "upload", files: [], pages: [], errorMessage: null })
  }

  if (state.step === "upload") {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <DropZone onFiles={handleFiles} />
      </div>
    )
  }

  if (state.step === "success") {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <SuccessCard
          fileName="Organized_Document.pdf"
          fileUrl="#"
          onReset={reset}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      {/* Invisible Thumbnail Generators */}
      {state.files.map(file => (
        <ThumbnailGenerator
          key={file.id}
          file={file}
          onPagesExtracted={handlePagesExtracted}
        />
      ))}

      {/* Header & Controls */}
      <div className="flex shrink-0 items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organize PDF</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag pages to reorder, or organize entire files at once.
          </p>
        </div>
        <ActionControls
          onAddFiles={() => inputRef.current?.click()}
          onSortAZ={handleSortAZ}
          onSort19={handleSort19}
          onExport={handleExport}
          isProcessing={state.step === "processing"}
          hasFiles={state.files.length > 0}
        />
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf"
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || [])
            if (files.length > 0) handleFiles(files)
            if (inputRef.current) inputRef.current.value = ""
          }}
        />
      </div>

      {/* Main Workspace */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-6 min-h-0 overflow-hidden items-stretch">
          <MainCanvas
            pages={state.pages}
            files={state.files}
            onDeletePage={handleDeletePage}
            onRotatePage={handleRotatePage}
            onAddBlank={handleAddBlankPage}
          />
          <FileStack
            files={state.files}
            onResetAll={reset}
          />
        </div>
      </DndContext>
    </div>
  )
}
