"use client"

import { useState, useEffect } from "react"
import { ThemeProvider } from "@/renderer/components/theme-provider"
import { ZoomProvider } from "@/renderer/components/zoom-provider"
import AppLayoutPage from "@/renderer/pages/app-layout-page"
import LoadingScreen from "@/renderer/components/loading-screen"

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate initial loading time - replace with actual initialization logic
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ZoomProvider>
        {isLoading ? <LoadingScreen /> : <AppLayoutPage />}
      </ZoomProvider>      
    </ThemeProvider>
  )
}

export default App