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

  // Apply zoom to document body whenever zoomLevel changes
  useEffect(() => {
    document.body.style.zoom = `${zoomLevel}%`
    // Save zoom level to localStorage
    localStorage.setItem("configpilot_zoom", zoomLevel.toString())
  }, [zoomLevel])

  // Also apply zoom immediately on mount to handle any edge cases
  useEffect(() => {
    document.body.style.zoom = `${zoomLevel}%`
  }, [])

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
