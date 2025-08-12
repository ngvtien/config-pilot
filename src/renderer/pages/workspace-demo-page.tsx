"use client"

import React, { useState } from "react"
import { WorkspaceLayout } from "@/renderer/components/products/product-workspace-resizable"
import { NavigatorPanel } from "@/renderer/components/products/product-navigator-panel"
import { Card, CardContent, CardHeader, CardTitle } from "@/renderer/components/ui/card"
import { Badge } from "@/renderer/components/ui/badge"
import { Button } from "@/renderer/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs"
import { typography } from "@/renderer/lib/typography"
import { FileText, Settings, Activity, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Demo workspace page to test the new architecture
 */
export const WorkspaceDemoPage: React.FC = () => {
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  return (
    <div className="h-screen w-full">
      <WorkspaceLayout
        persistenceKey="demo-workspace"
        navigator={
          <NavigatorPanel
            onProductSelect={setSelectedProduct}
            selectedProductId={selectedProduct?.id}
          />
        }
        editor={
          <div className="h-full p-4">
            <Tabs defaultValue="form" className="h-full">
              <TabsList>
                <TabsTrigger value="form">Form Editor</TabsTrigger>
                <TabsTrigger value="yaml">YAML Editor</TabsTrigger>
                <TabsTrigger value="k8s">K8s Resources</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="h-full">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className={typography.card.title}>
                      {selectedProduct ? `Editing: ${selectedProduct.name}` : "Select a product to edit"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedProduct ? (
                      <div className="space-y-4">
                        <p className={typography.utils.body}>
                          Form editor for {selectedProduct.name} would appear here.
                        </p>
                        <div className="flex gap-2">
                          <Button>Save Changes</Button>
                          <Button variant="outline">Preview</Button>
                        </div>
                      </div>
                    ) : (
                      <p className={typography.utils.body}>Choose a product from the navigator to start editing.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="yaml" className="h-full">
                <Card className="h-full">
                  <CardContent className="p-4">
                    <div className={cn("h-full bg-muted/30 rounded p-4", typography.editor.text)}>
                      # YAML Editor would be integrated here
                      {selectedProduct && `\n# Configuration for ${selectedProduct.name}`}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        }
        context={
          <div className="h-full p-3 space-y-4">
            {selectedProduct ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className={typography.card.title}>Dependencies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge variant="outline">Database Service</Badge>
                    <Badge variant="outline">Redis Cache</Badge>
                    <Badge variant="outline">Message Queue</Badge>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className={typography.card.title}>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <GitBranch className="h-4 w-4 mr-2" />
                      Create Branch
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Activity className="h-4 w-4 mr-2" />
                      View Metrics
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <p className={typography.utils.body}>Select a product to view context information.</p>
                </CardContent>
              </Card>
            )}
          </div>
        }
        output={
          <div className="h-full p-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className={typography.card.title}>Output & Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="validation">
                  <TabsList>
                    <TabsTrigger value="validation">Validation</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                  </TabsList>
                  <TabsContent value="validation">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className={typography.utils.body}>Schema validation passed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className={typography.utils.body}>Kubernetes resources valid</span>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        }
      />
    </div>
  )
}