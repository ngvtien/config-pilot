"use client"

import { ThemeProvider } from "@/renderer/components/theme-provider"
import { ZoomProvider } from "@/renderer/components/zoom-provider"
import { ProjectProvider } from "@/renderer/contexts/project-context"
import AppLayoutPage from "@/renderer/pages/app-layout-page"
import { Toaster } from "@/renderer/components/ui/toaster"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ZoomProvider>
        <ProjectProvider>
          <AppLayoutPage />
          <Toaster />
        </ProjectProvider>
      </ZoomProvider>      
    </ThemeProvider>
  )

}

export default App