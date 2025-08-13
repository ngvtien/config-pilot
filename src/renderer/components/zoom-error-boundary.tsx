import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '../logger'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error boundary specifically for zoom-related errors
 * Provides graceful fallback and recovery options
 */
export class ZoomErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log zoom-related errors
    logger.error('Zoom Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })
  }

  handleReset = () => {
    // Reset zoom to default and clear error state
    try {
      // Reset zoom styles
      const zoomStyles = document.getElementById('zoom-styles-v2')
      if (zoomStyles) {
        zoomStyles.remove()
      }
      
      // Reset HTML zoom
      document.documentElement.style.zoom = '1'
      
      // Clear error state
      this.setState({ hasError: false, error: undefined })
      
      logger.info('Zoom error boundary reset successfully')
    } catch (resetError) {
      logger.error('Failed to reset zoom error boundary:', resetError)
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Zoom System Error</AlertTitle>
            <AlertDescription className="mt-2">
              The zoom system encountered an error. This might be due to browser compatibility issues or conflicting styles.
            </AlertDescription>
            <div className="mt-4">
              <Button 
                onClick={this.handleReset}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Zoom
              </Button>
            </div>
          </Alert>
        </div>
      )
    }

    return this.props.children
  }
}