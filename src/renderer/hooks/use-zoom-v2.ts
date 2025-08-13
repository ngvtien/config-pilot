import { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '../logger'

/**
 * Zoom levels supported by the application
 */
export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const
export type ZoomLevel = typeof ZOOM_LEVELS[number]

/**
 * Enhanced zoom hook with better error handling and separation of concerns
 */
export function useZoomV2() {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(1)
  const [isApplying, setIsApplying] = useState(false)
  const styleElementRef = useRef<HTMLStyleElement | null>(null)
  const errorCountRef = useRef(0)
  const maxRetries = 3

  /**
   * Generate CSS rules for zoom-exclude elements
   */
  const generateZoomExcludeCSS = useCallback((zoom: ZoomLevel): string => {
    const counterZoom = 1 / zoom
    
    return `
      /* Zoom-exclude base rules */
      .zoom-exclude {
        transform: scale(${counterZoom}) !important;
        transform-origin: center !important;
        width: calc(var(--original-width, auto) * ${zoom}) !important;
        height: calc(var(--original-height, auto) * ${zoom}) !important;
      }
      
      /* Icon-specific zoom-exclude rules */
      .zoom-exclude.h-3.w-3 {
        width: calc(0.75rem * ${zoom}) !important;
        height: calc(0.75rem * ${zoom}) !important;
      }
      
      .zoom-exclude.h-4.w-4 {
        width: calc(1rem * ${zoom}) !important;
        height: calc(1rem * ${zoom}) !important;
      }
      
      .zoom-exclude.h-5.w-5 {
        width: calc(1.25rem * ${zoom}) !important;
        height: calc(1.25rem * ${zoom}) !important;
      }
      
      .zoom-exclude.h-6.w-6 {
        width: calc(1.5rem * ${zoom}) !important;
        height: calc(1.5rem * ${zoom}) !important;
      }
      
      /* Prevent zoom-exclude from affecting layout */
      .zoom-exclude {
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
      }
    `
  }, [])

  /**
   * Apply zoom styles with error handling
   */
  const applyZoomStyles = useCallback(async (zoom: ZoomLevel) => {
    try {
      setIsApplying(true)
      
      // Remove existing style element
      if (styleElementRef.current) {
        styleElementRef.current.remove()
        styleElementRef.current = null
      }
      
      // Create new style element
      const styleElement = document.createElement('style')
      styleElement.id = 'zoom-styles-v2'
      styleElement.textContent = `
        html {
          zoom: ${zoom};
        }
        
        ${generateZoomExcludeCSS(zoom)}
      `
      
      document.head.appendChild(styleElement)
      styleElementRef.current = styleElement
      
      // Reset error count on success
      errorCountRef.current = 0
      
      logger.info(`Zoom applied successfully: ${zoom * 100}%`)
    } catch (error) {
      errorCountRef.current++
      logger.error('Failed to apply zoom styles:', error)
      
      // Retry if under max retries
      if (errorCountRef.current < maxRetries) {
        setTimeout(() => applyZoomStyles(zoom), 100)
      } else {
        logger.error(`Max retries (${maxRetries}) exceeded for zoom application`)
      }
    } finally {
      setIsApplying(false)
    }
  }, [generateZoomExcludeCSS])

  /**
   * Set zoom level with validation
   */
  const setZoom = useCallback((newZoom: ZoomLevel) => {
    if (!ZOOM_LEVELS.includes(newZoom)) {
      logger.warn(`Invalid zoom level: ${newZoom}. Using closest valid level.`)
      // Find closest valid zoom level
      const closest = ZOOM_LEVELS.reduce((prev, curr) => 
        Math.abs(curr - newZoom) < Math.abs(prev - newZoom) ? curr : prev
      )
      newZoom = closest
    }
    
    setZoomLevel(newZoom)
  }, [])

  /**
   * Zoom in to next level
   */
  const zoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel)
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setZoom(ZOOM_LEVELS[currentIndex + 1])
    }
  }, [zoomLevel, setZoom])

  /**
   * Zoom out to previous level
   */
  const zoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel)
    if (currentIndex > 0) {
      setZoom(ZOOM_LEVELS[currentIndex - 1])
    }
  }, [zoomLevel, setZoom])

  /**
   * Reset zoom to 100%
   */
  const resetZoom = useCallback(() => {
    setZoom(1)
  }, [setZoom])

  // Apply zoom styles when zoom level changes
  useEffect(() => {
    applyZoomStyles(zoomLevel)
  }, [zoomLevel, applyZoomStyles])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (styleElementRef.current) {
        styleElementRef.current.remove()
      }
    }
  }, [])

  return {
    zoomLevel,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    isApplying,
    canZoomIn: zoomLevel < ZOOM_LEVELS[ZOOM_LEVELS.length - 1],
    canZoomOut: zoomLevel > ZOOM_LEVELS[0],
    zoomPercentage: Math.round(zoomLevel * 100),
  }
}