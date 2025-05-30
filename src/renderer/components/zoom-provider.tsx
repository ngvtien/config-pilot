"use client"

import type React from "react"
import { useEffect } from "react"
import { ZoomContext, useZoomSetup } from "../hooks/use-zoom"

interface ZoomProviderProps {
  children: React.ReactNode
}

export function ZoomProvider({ children }: ZoomProviderProps) {
  const zoom = useZoomSetup()

  // Ctrl+Scroll wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY > 0) {
          zoom.decreaseZoom()
        } else {
          zoom.increaseZoom()
        }
      }
    }

    document.addEventListener("wheel", handleWheel, { passive: false })
    return () => document.removeEventListener("wheel", handleWheel)
  }, [zoom])

  return <ZoomContext.Provider value={zoom}>{children}</ZoomContext.Provider>
}
