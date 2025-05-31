import React from 'react'
import { useEffect } from "react"
import { useApiCall } from '@/renderer/hooks/use-api-call'
import { KubernetesService } from '@/renderer/services/kubernetes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/renderer/components/ui/select'
import {
  Alert,
  AlertDescription
} from '@/renderer/components/ui/alert'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { KubernetesContext } from '@/shared/types/kubernetes'


interface KubernetesContextSelectorProps {
  onContextChange: (context: string) => void
  className?: string
}

const KubernetesContextSelector = React.memo(({ onContextChange, className = '' }: KubernetesContextSelectorProps) => {
  // Use the shared API call hook for contexts
  const { 
    data: contexts = [], 
    loading: contextsLoading,
    error: contextsError,
    execute: loadContexts 
  } = useApiCall<KubernetesContext[]>({
    apiFunction: KubernetesService.getContexts,
    initialData: [] // Explicitly set initial data
  });

  // Use another instance for current context
  const {
    data: currentContext = '',
    loading: currentContextLoading,
    execute: loadCurrentContext
  } = useApiCall<string>({
    apiFunction: KubernetesService.getCurrentContext
  });

  // Use for context switching
  const {
    loading: switchingContext,
    error: switchError,
    execute: executeContextSwitch
  } = useApiCall<boolean>({
    apiFunction: async (contextName: string) => {
      const success = await KubernetesService.switchContext(contextName);
      if (success) {
        onContextChange(contextName);
        await loadCurrentContext();
      }
      return success;
    }
  });

  // Load initial data
  useEffect(() => {
    console.log('Loading contexts...');
    loadContexts().then(() => {
      console.log('Contexts loaded:', contexts);
    }).catch((error: any) => {
      console.error('Error loading contexts:', error);
    });
  }, []);

  const isLoading = contextsLoading || currentContextLoading || switchingContext;
  const error = contextsError || switchError;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading contexts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Select
      value={currentContext}
      onValueChange={executeContextSwitch}
      disabled={isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select Kubernetes context" />
      </SelectTrigger>
      <SelectContent>
        {Array.isArray(contexts) && contexts.map((context) => (
          <SelectItem key={context.name} value={context.name}>
            {context.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

KubernetesContextSelector.displayName = 'KubernetesContextSelector';

export default KubernetesContextSelector;