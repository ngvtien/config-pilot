/**
 * Utility functions for generating Helm templates
 */

/**
 * Generate Helm resource template
 * @param resource - Kubernetes resource object
 * @param templateName - Name of the template
 * @returns Generated Helm template string
 */
export const generateHelmResourceTemplate = (resource: any, templateName: string): string => {
  const chartName = templateName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  
  let template = `apiVersion: ${resource.apiVersion}\n`
  template += `kind: ${resource.kind}\n`
  template += `metadata:\n`
  template += `  name: {{ include "${chartName}.fullname" . }}\n`
  template += `  labels:\n`
  template += `    {{- include "${chartName}.labels" . | nindent 4 }}\n`
  
  if (resource.kind === 'Deployment' || resource.kind === 'StatefulSet' || resource.kind === 'DaemonSet') {
    template += `spec:\n`
    template += `  replicas: {{ .Values.${resource.kind.toLowerCase()}.replicas | default 1 }}\n`
    template += `  selector:\n`
    template += `    matchLabels:\n`
    template += `      {{- include "${chartName}.selectorLabels" . | nindent 6 }}\n`
    template += `  template:\n`
    template += `    metadata:\n`
    template += `      labels:\n`
    template += `        {{- include "${chartName}.selectorLabels" . | nindent 8 }}\n`
    template += `    spec:\n`
    template += `      containers:\n`
    template += `      - name: {{ .Chart.Name }}\n`
    template += `        image: "{{ .Values.${resource.kind.toLowerCase()}.image.repository }}:{{ .Values.${resource.kind.toLowerCase()}.image.tag | default .Chart.AppVersion }}"\n`
    template += `        imagePullPolicy: {{ .Values.${resource.kind.toLowerCase()}.image.pullPolicy }}\n`
  } else {
    template += `spec:\n`
    template += `  # Add your ${resource.kind} specification here\n`
    if (resource.selectedFields && resource.selectedFields.length > 0) {
      template += `  # Based on selected fields: ${resource.selectedFields.map((f: any) => f.path).join(', ')}\n`
    }
  }
  
  return template
}