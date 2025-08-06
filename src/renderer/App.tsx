"use client"

import React, { useEffect } from 'react';
import { ThemeProvider } from "@/renderer/components/theme-provider"
import { ZoomProvider } from "@/renderer/components/zoom-provider"
import { ProjectProvider } from "@/renderer/contexts/project-context"
import AppLayoutPage from "@/renderer/pages/app-layout-page"
import { Toaster } from "@/renderer/components/ui/toaster"
import { rendererLog, uiLog } from './logger';

function App() {
  useEffect(() => {
    rendererLog.info('🎨 React application mounted');
    
    return () => {
      rendererLog.info('🎨 React application unmounting');
    };
  }, []);
    
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