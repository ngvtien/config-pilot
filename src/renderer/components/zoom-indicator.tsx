"use client"

import React, { useState, useEffect } from 'react'
import { useZoom } from '../hooks/use-zoom'
import { cn } from '@/lib/utils'

interface ZoomIndicatorProps {
  className?: string
}

/**
 * Temporary zoom indicator that appears during mouse wheel zoom operations
 * Shows current zoom percentage with a fade-out animation
 */
export function ZoomIndicator({ className }: ZoomIndicatorProps) {
  const { zoomLevel } = useZoom()
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  // Show indicator when zoom level changes
  useEffect(() => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Show indicator
    setIsVisible(true)

    // Hide after 1.5 seconds of no zoom changes
    const newTimeoutId = setTimeout(() => {
      setIsVisible(false)
    }, 1500)

    setTimeoutId(newTimeoutId)

    // Cleanup on unmount
    return () => {
      if (newTimeoutId) {
        clearTimeout(newTimeoutId)
      }
    }
  }, [zoomLevel])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none",
        "bg-background/95 backdrop-blur-sm border rounded-xl shadow-2xl",
        "px-6 py-4 transition-all duration-300 ease-out",
        "animate-in fade-in-0 zoom-in-95",
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
        className
      )}
    >
      <div className="flex items-center gap-3 text-lg font-medium">
        <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
        <span className="font-mono text-2xl font-bold">{zoomLevel}%</span>
        <span className="text-muted-foreground text-base">zoom</span>
      </div>
    </div>
  )
}