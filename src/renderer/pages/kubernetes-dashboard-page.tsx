import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Badge } from '@/renderer/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs'
import { Button } from '@/renderer/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/renderer/components/ui/table'
import { RefreshCw, Server, Box, Network, Globe, Activity, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { KubernetesService } from '@/renderer/services/kubernetes'
import { useApiCall } from '@/renderer/hooks/use-api-call'
import KubernetesContextSelector from '@/renderer/components/kubernetes-context-selector'

function StatusBadge({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'ready':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'partial':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
      case 'error':
      case 'notready':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'ready':
        return <CheckCircle className="h-3 w-3" />
      case 'pending':
      case 'partial':
        return <AlertCircle className="h-3 w-3" />
      case 'failed':
      case 'error':
      case 'notready':
        return <XCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  return (
    <Badge className={`${getStatusColor(status)} flex items-center gap-1`}>
      {getStatusIcon(status)}
      {status}
    </Badge>
  )
}

function NamespaceSelector({ namespaces, selected, onSelect }: {
  namespaces: any[]
  selected: string
  onSelect: (value: string) => void
}) {
  return (
    <Select value={selected} onValueChange={onSelect}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select namespace" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Namespaces</SelectItem>
        {namespaces.map((ns) => (
          <SelectItem key={ns.name} value={ns.name}>
            {ns.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PodsTable({ pods, loading }: { pods: any[], loading: boolean }) {
  if (loading) {
    return <div className="text-center py-8">Loading pods...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="h-5 w-5" />
          Pods ({pods.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ready</TableHead>
              <TableHead>Restarts</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pods.map((pod) => (
              <TableRow key={`${pod.namespace}/${pod.name}`}>
                <TableCell className="font-medium">{pod.name}</TableCell>
                <TableCell>{pod.namespace}</TableCell>
                <TableCell><StatusBadge status={pod.status} /></TableCell>
                <TableCell>{pod.ready}</TableCell>
                <TableCell>{pod.restarts}</TableCell>
                <TableCell>{pod.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function DeploymentsTable({ deployments, loading }: { deployments: any[], loading: boolean }) {
  if (loading) {
    return <div className="text-center py-8">Loading deployments...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Deployments ({deployments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ready</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Images</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((deployment) => (
              <TableRow key={`${deployment.namespace}/${deployment.name}`}>
                <TableCell className="font-medium">{deployment.name}</TableCell>
                <TableCell>{deployment.namespace}</TableCell>
                <TableCell><StatusBadge status={deployment.status} /></TableCell>
                <TableCell>{deployment.replicas.ready}/{deployment.replicas.total}</TableCell>
                <TableCell>{deployment.age}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {deployment.images.slice(0, 2).map((image: string, idx: number) => (
                      <div key={idx} className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {image.split('/').pop()}
                      </div>
                    ))}
                    {deployment.images.length > 2 && (
                      <div className="text-xs text-muted-foreground">+{deployment.images.length - 2} more</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ServicesTable({ services, loading }: { services: any[], loading: boolean }) {
  if (loading) {
    return <div className="text-center py-8">Loading services...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Services ({services.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Cluster IP</TableHead>
              <TableHead>External IP</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={`${service.namespace}/${service.name}`}>
                <TableCell className="font-medium">{service.name}</TableCell>
                <TableCell>{service.namespace}</TableCell>
                <TableCell><Badge variant="outline">{service.type}</Badge></TableCell>
                <TableCell className="font-mono text-sm">{service.clusterIP}</TableCell>
                <TableCell className="font-mono text-sm">{service.externalIP}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {service.ports.slice(0, 3).map((port: string, idx: number) => (
                      <div key={idx} className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {port}
                      </div>
                    ))}
                    {service.ports.length > 3 && (
                      <div className="text-xs text-muted-foreground">+{service.ports.length - 3} more</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{service.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function NodesTable({ nodes, loading }: { nodes: any[], loading: boolean }) {
  if (loading) {
    return <div className="text-center py-8">Loading nodes...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Nodes ({nodes.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => (
              <TableRow key={node.name}>
                <TableCell className="font-medium">{node.name}</TableCell>
                <TableCell><StatusBadge status={node.status} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {node.roles.map((role: string) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{node.version}</TableCell>
                <TableCell>{node.age}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function KubernetesDashboardPage() {
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  // API calls for different resources
// API calls for different resources
const { data: connectionStatus, loading: statusLoading, execute: loadStatus } = useApiCall({
    apiFunction: () => KubernetesService.getConnectionStatus()
  })
  
  const { data: namespaces, loading: namespacesLoading, execute: loadNamespaces } = useApiCall({
    apiFunction: () => KubernetesService.getNamespaces()
  })
  
  const { data: pods, loading: podsLoading, execute: loadPods } = useApiCall({
    apiFunction: () => KubernetesService.getPods(selectedNamespace === 'all' ? undefined : selectedNamespace)
  })
  
  const { data: deployments, loading: deploymentsLoading, execute: loadDeployments } = useApiCall({
    apiFunction: () => KubernetesService.getDeployments(selectedNamespace === 'all' ? undefined : selectedNamespace)
  })
  
  const { data: services, loading: servicesLoading, execute: loadServices } = useApiCall({
    apiFunction: () => KubernetesService.getServices(selectedNamespace === 'all' ? undefined : selectedNamespace)
  })
  
  const { data: nodes, loading: nodesLoading, execute: loadNodes } = useApiCall({
    apiFunction: () => KubernetesService.getNodes()
  })

  // Load data on mount and when refresh key changes
  useEffect(() => {
    loadStatus()
    loadNamespaces()
    loadNodes()
  }, [refreshKey])

  // Load namespace-specific data when namespace changes
  useEffect(() => {
    if (connectionStatus?.connected) {
      loadPods()
      loadDeployments()
      loadServices()
    }
  }, [selectedNamespace, connectionStatus?.connected])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleContextChange = () => {
    setRefreshKey(prev => prev + 1)
  }

// Add this useEffect for auto-refresh
useEffect(() => {
    const interval = setInterval(() => {
      if (connectionStatus?.connected) {
        handleRefresh()
      }
    }, 30000) // Refresh every 30 seconds
  
    return () => clearInterval(interval)
  }, [connectionStatus?.connected])
    
  if (!connectionStatus?.connected) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Kubernetes Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Not connected to Kubernetes cluster</p>
              <KubernetesContextSelector onContextChange={handleContextChange} />
              <Button onClick={() => KubernetesService.connect()} className="mt-4">
                Connect
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6" />
            Kubernetes Dashboard
          </h1>
          <p className="text-muted-foreground">
            Context: <Badge variant="outline">{connectionStatus.currentContext}</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <KubernetesContextSelector onContextChange={handleContextChange} />
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Namespaces</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{namespaces?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pods</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pods?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {pods?.filter(p => p.status === 'Running').length || 0} running
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nodes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nodes?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {nodes?.filter(n => n.status === 'Ready').length || 0} ready
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resource Tables */}
      <Tabs defaultValue="pods" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pods">Pods</TabsTrigger>
            <TabsTrigger value="deployments">Deployments</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="nodes">Nodes</TabsTrigger>
          </TabsList>
          
          <NamespaceSelector 
            namespaces={namespaces || []} 
            selected={selectedNamespace}
            onSelect={setSelectedNamespace}
          />
        </div>

        <TabsContent value="pods">
          <PodsTable pods={pods || []} loading={podsLoading} />
        </TabsContent>
        
        <TabsContent value="deployments">
          <DeploymentsTable deployments={deployments || []} loading={deploymentsLoading} />
        </TabsContent>
        
        <TabsContent value="services">
          <ServicesTable services={services || []} loading={servicesLoading} />
        </TabsContent>
        
        <TabsContent value="nodes">
          <NodesTable nodes={nodes || []} loading={nodesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}