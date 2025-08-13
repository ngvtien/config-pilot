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
  if (!context) {
    throw new Error('useZoom must be used within a ZoomProvider')
  }
  return context
}

export function useZoomSetup() {
  const [zoomLevel, setZoomLevel] = useState(100)

  // Load zoom level from localStorage on mount
  useEffect(() => {
    const savedZoom = localStorage.getItem("configpilot_zoom")
    if (savedZoom) {
      const parsedZoom = parseInt(savedZoom, 10)
      if (parsedZoom >= 50 && parsedZoom <= 200) {
        setZoomLevel(parsedZoom)
      }
    }
  }, [])

  // Apply zoom styles whenever zoom level changes
  useEffect(() => {
    // Set CSS custom properties for consistent icon sizing
    document.documentElement.style.setProperty('--icon-size-3', '0.75rem')
    document.documentElement.style.setProperty('--icon-size-4', '1rem')
    document.documentElement.style.setProperty('--icon-size-5', '1.25rem')
    document.documentElement.style.setProperty('--icon-size-6', '1.5rem')
    
    // Create or update zoom stylesheet
    let zoomStylesheet = document.getElementById('zoom-content-styles') as HTMLStyleElement
    if (!zoomStylesheet) {
      zoomStylesheet = document.createElement('style')
      zoomStylesheet.id = 'zoom-content-styles'
      document.head.appendChild(zoomStylesheet)
    }
    
    // Build CSS content - ONLY zoom-exclude rules, NO global body zoom!
    const baseStyles = `
      /* ONLY apply to elements that explicitly have zoom-exclude class */
      .zoom-exclude {
        transform: none !important;
        zoom: 1 !important;
        font-size: inherit !important;
        scale: 1 !important;
      }
      
      /* Size-specific zoom-exclude rules - ONLY for elements with zoom-exclude class */
      .zoom-exclude.h-3,
      .zoom-exclude.w-3 {
        width: var(--icon-size-3) !important;
        height: var(--icon-size-3) !important;
        min-width: var(--icon-size-3) !important;
        min-height: var(--icon-size-3) !important;
        max-width: var(--icon-size-3) !important;
        max-height: var(--icon-size-3) !important;
      }
      
      .zoom-exclude.h-4,
      .zoom-exclude.w-4 {
        width: var(--icon-size-4) !important;
        height: var(--icon-size-4) !important;
        min-width: var(--icon-size-4) !important;
        min-height: var(--icon-size-4) !important;
        max-width: var(--icon-size-4) !important;
        max-height: var(--icon-size-4) !important;
      }
      
      .zoom-exclude.h-5,
      .zoom-exclude.w-5 {
        width: var(--icon-size-5) !important;
        height: var(--icon-size-5) !important;
        min-width: var(--icon-size-5) !important;
        min-height: var(--icon-size-5) !important;
        max-width: var(--icon-size-5) !important;
        max-height: var(--icon-size-5) !important;
      }
      
      .zoom-exclude.h-6,
      .zoom-exclude.w-6 {
        width: var(--icon-size-6) !important;
        height: var(--icon-size-6) !important;
        min-width: var(--icon-size-6) !important;
        min-height: var(--icon-size-6) !important;
        max-width: var(--icon-size-6) !important;
        max-height: var(--icon-size-6) !important;
      }
      
      /* Apply zoom ONLY to specific content areas, NOT controls */
      .zoomable-content {
        zoom: ${zoomLevel / 100};
      }
      
      /* Ensure these elements are NEVER zoomed */
      .sidebar,
      .toolbar,
      .navigation,
      .panel-header,
      .workspace-panel-header,
      .settings-panel,
      .zoom-controls,
      [data-panel-group],
      [data-panel],
      [data-panel-resize-handle-id],
      .react-resizable-handle,
      .panel-resize-handle {
        zoom: 1 !important;
        transform: none !important;
        font-size: inherit !important;
      }
    `
    
    // Apply styles - NO MORE GLOBAL BODY ZOOM!
    zoomStylesheet.textContent = baseStyles
    
    // Save zoom level to localStorage
    localStorage.setItem("configpilot_zoom", zoomLevel.toString())
  }, [zoomLevel])

  // Define callbacks with useCallback to prevent unnecessary re-renders
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