"use client"

import { useState, useEffect, useCallback, createContext, useContext } from "react"

interface ZoomContextType {
  zoomLevel: number
  setZoomLevel: (level: number) => void
  increaseZoom: () => void
  decreaseZoom: () => void
  resetZoom: () => void
}

export const ZoomContext = createContext<ZoomContextType | undefined>(undefined)

export function useZoom() {
  const context = useContext(ZoomContext)
  if (context === undefined) {
    throw new Error("useZoom must be used within a ZoomProvider")
  }
  return context
}

export function useZoomSetup() {
  // Initialize with saved zoom level or default to 100
  const [zoomLevel, setZoomLevel] = useState(() => {
    const savedZoom = localStorage.getItem("configpilot_zoom")
    if (savedZoom) {
      const zoom = Number.parseInt(savedZoom)
      if (zoom >= 50 && zoom <= 200) {
        return zoom
      }
    }
    return 100
  })

  // Content-only zoom approach - preserves panel layout
  useEffect(() => {
    const zoomFactor = zoomLevel / 100
    
    // Remove any existing zoom styles
    const rootElement = document.querySelector('#root')
    if (rootElement instanceof HTMLElement) {
      rootElement.style.removeProperty('zoom')
    }
    
    // Set CSS custom property for zoom factor
    document.documentElement.style.setProperty('--zoom-factor', zoomFactor.toString())
    
    // Create or update zoom stylesheet
    let zoomStylesheet = document.getElementById('zoom-content-styles') as HTMLStyleElement
    if (!zoomStylesheet) {
      zoomStylesheet = document.createElement('style')
      zoomStylesheet.id = 'zoom-content-styles'
      document.head.appendChild(zoomStylesheet)
    }
    
    // Define content-only zoom rules that preserve panel structure
    zoomStylesheet.textContent = `
      /* Scale text content */
      .zoom-content,
      .cm-editor,
      .cm-content,
      .cm-line,
      input[type="text"],
      input[type="search"],
      textarea,
      .prose,
      p, h1, h2, h3, h4, h5, h6,
      span:not([data-panel-resize-handle-id]),
      button span,
      .text-sm, .text-base, .text-lg,
      .card-content,
      .scroll-area-content {
        font-size: calc(1rem * var(--zoom-factor)) !important;
        line-height: calc(1.5 * var(--zoom-factor)) !important;
      }
      
      /* Scale icons with minimum size protection */
      svg:not(.zoom-exclude):not([data-panel-resize-handle-id] svg),
      .lucide:not(.zoom-exclude),
      .icon:not(.zoom-exclude) {
        width: calc(max(12px, 1em * var(--zoom-factor))) !important;
        height: calc(max(12px, 1em * var(--zoom-factor))) !important;
      }
      
      /* ABSOLUTE protection for zoom-exclude elements */
      .zoom-exclude,
      .zoom-exclude svg,
      .zoom-exclude .lucide,
      .zoom-exclude .icon {
        width: inherit !important;
        height: inherit !important;
        min-width: inherit !important;
        min-height: inherit !important;
        max-width: inherit !important;
        max-height: inherit !important;
        font-size: inherit !important;
        transform: none !important;
        zoom: 1 !important;
      }
      
      /* Force specific sizes for Tailwind classes on zoom-exclude elements */
      .zoom-exclude.h-3 { height: 0.75rem !important; }
      .zoom-exclude.w-3 { width: 0.75rem !important; }
      .zoom-exclude.h-4 { height: 1rem !important; }
      .zoom-exclude.w-4 { width: 1rem !important; }
      .zoom-exclude.h-5 { height: 1.25rem !important; }
      .zoom-exclude.w-5 { width: 1.25rem !important; }
      .zoom-exclude.h-6 { height: 1.5rem !important; }
      .zoom-exclude.w-6 { width: 1.5rem !important; }
      
      /* Force specific sizes for nested SVGs in zoom-exclude buttons */
      .zoom-exclude svg.h-3,
      .zoom-exclude .lucide.h-3 { height: 0.75rem !important; }
      .zoom-exclude svg.w-3,
      .zoom-exclude .lucide.w-3 { width: 0.75rem !important; }
      .zoom-exclude svg.h-4,
      .zoom-exclude .lucide.h-4 { height: 1rem !important; }
      .zoom-exclude svg.w-4,
      .zoom-exclude .lucide.w-4 { width: 1rem !important; }
      
      /* Scale form elements */
      input, textarea, select {
        padding: calc(0.5rem * var(--zoom-factor)) !important;
      }
      
      /* Scale buttons - but exclude zoom-exclude buttons */
      button:not([data-panel-resize-handle-id]):not(.zoom-exclude) {
        padding: calc(0.5rem * var(--zoom-factor)) calc(1rem * var(--zoom-factor)) !important;
      }
      
      /* Preserve panel structure - DO NOT scale these */
      [data-panel-group],
      [data-panel],
      [data-panel-resize-handle-id],
      .react-resizable-handle,
      .workspace-panel-header,
      .panel-resize-handle {
        font-size: inherit !important;
        transform: none !important;
        zoom: 1 !important;
      }
      
      /* Preserve toolbar and navigation structure */
      .toolbar,
      .navigation,
      .panel-header,
      .workspace-panel > .flex.items-center:first-child {
        font-size: 0.875rem !important;
        line-height: 1.25rem !important;
      }
    `
    
    // Save zoom level to localStorage
    localStorage.setItem("configpilot_zoom", zoomLevel.toString())
  }, [zoomLevel])

  const increaseZoom = useCallback(() => {
    setZoomLevel((prev) => Math.min(200, prev + 10))
  }, [])

  const decreaseZoom = useCallback(() => {
    setZoomLevel((prev) => Math.max(50, prev - 10))
  }, [])

  const resetZoom = useCallback(() => {
    setZoomLevel(100)
  }, [])

  return {
    zoomLevel,
    setZoomLevel,
    increaseZoom,
    decreaseZoom,
    resetZoom,
  }
}