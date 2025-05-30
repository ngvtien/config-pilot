"use client"

import { ThemeProvider } from "@/renderer/components/theme-provider"
import { ZoomProvider } from "@/renderer/components/zoom-provider"
import AppLayoutPage from "@/renderer/pages/app-layout-page"

function App() {

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ZoomProvider>
        <AppLayoutPage />
      </ZoomProvider>      
    </ThemeProvider>
  )
}

export default App
