"use client"

import { useState } from "react"
import { FileExplorer } from "@/renderer/components/file-explorer"

interface FileExplorerContext {
  baseDirectory: string
  customer: string
  product: string
  environment: string
  instance: number
}

interface FileExplorerPageProps {
  context: FileExplorerContext
}

interface FileSystemItem {
  id: string
  name: string
  type: "file" | "folder"
  path: string
  size?: number
  lastModified?: Date
  children?: FileSystemItem[]
  contextLevel?: "base" | "customer" | "product" | "environment" | "instance" | "content"
  metadata?: {
    customer?: string
    product?: string
    environment?: string
    instance?: number
  }
}

export default function FileExplorerPage({ context: initialContext }: FileExplorerPageProps) {
  const [context, setContext] = useState<FileExplorerContext>(initialContext)

  const [selectedFile, setSelectedFile] = useState<FileSystemItem | null>(null)

  const handleContextChange = (newContext: Partial<FileExplorerContext>) => {
    setContext((prev) => ({ ...prev, ...newContext }))
  }

  const handleFileSelect = (file: FileSystemItem) => {
    setSelectedFile(file)
  }

  return (
    <div className="container mx-auto p-6 h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">File Explorer</h1>
        <p className="text-slate-600 dark:text-slate-400">Context-aware file browser for customer configurations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* File Explorer */}
        <div className="lg:col-span-2">
          <FileExplorer
            context={context}
            onFileSelect={handleFileSelect}
            onContextChange={handleContextChange}
            className="h-full"
          />
        </div>

        {/* File Details Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">File Details</h3>

          {selectedFile ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Name</label>
                <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1">{selectedFile.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Path</label>
                <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1 break-all">
                  {selectedFile.path}
                </p>
              </div>

              {selectedFile.size && (
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Size</label>
                  <p className="text-sm mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              )}

              {selectedFile.lastModified && (
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Last Modified</label>
                  <p className="text-sm mt-1">{selectedFile.lastModified.toLocaleString()}</p>
                </div>
              )}

              {selectedFile.metadata && (
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Context</label>
                  <div className="text-sm mt-1 space-y-1">
                    {selectedFile.metadata.customer && (
                      <p>
                        <span className="font-medium">Customer:</span> {selectedFile.metadata.customer}
                      </p>
                    )}
                    {selectedFile.metadata.product && (
                      <p>
                        <span className="font-medium">Product:</span> {selectedFile.metadata.product}
                      </p>
                    )}
                    {selectedFile.metadata.environment && (
                      <p>
                        <span className="font-medium">Environment:</span> {selectedFile.metadata.environment}
                      </p>
                    )}
                    {selectedFile.metadata.instance && (
                      <p>
                        <span className="font-medium">Instance:</span> {selectedFile.metadata.instance}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-sm">Select a file to view details</p>
          )}
        </div>
      </div>

      {/* Current Context Display */}
      <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Current Context</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="font-medium">Base:</span>
            <p className="text-slate-600 dark:text-slate-400">{context.baseDirectory}</p>
          </div>
          <div>
            <span className="font-medium">Customer:</span>
            <p className="text-slate-600 dark:text-slate-400">{context.customer || "Not selected"}</p>
          </div>
          <div>
            <span className="font-medium">Product:</span>
            <p className="text-slate-600 dark:text-slate-400">{context.product || "Not selected"}</p>
          </div>
          <div>
            <span className="font-medium">Environment:</span>
            <p className="text-slate-600 dark:text-slate-400">{context.environment || "Not selected"}</p>
          </div>
          <div>
            <span className="font-medium">Instance:</span>
            <p className="text-slate-600 dark:text-slate-400">{context.instance || "Not selected"}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
