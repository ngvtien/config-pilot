import React, { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/renderer/components/ui/alert'
import { Badge } from '@/renderer/components/ui/badge'
import { Button } from '@/renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { Template } from '@/shared/types/template'

interface ValidationResult {
  type: 'error' | 'warning' | 'info' | 'success'
  message: string
  field?: string
  suggestion?: string
}

interface TemplateValidatorProps {
  template: Template
  onValidationChange: (isValid: boolean, results: ValidationResult[]) => void
}

export function TemplateValidator({ template, onValidationChange }: TemplateValidatorProps) {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
  const [isValidating, setIsValidating] = useState(false)

  const validateTemplate = async () => {
    setIsValidating(true)
    const results: ValidationResult[] = []

    // Template name validation
    if (!template.name || template.name.trim().length === 0) {
      results.push({
        type: 'error',
        message: 'Template name is required',
        suggestion: 'Provide a descriptive name for your template'
      })
    } else if (template.name.length < 3) {
      results.push({
        type: 'warning',
        message: 'Template name is very short',
        suggestion: 'Consider using a more descriptive name'
      })
    }

    // Resources validation
    if (!template.resources || template.resources.length === 0) {
      results.push({
        type: 'error',
        message: 'At least one resource is required',
        suggestion: 'Add Kubernetes resources to your template'
      })
    } else {
      // Validate each resource
      template.resources.forEach((resource, index) => {
        if (!resource.selectedFields || resource.selectedFields.length === 0) {
          results.push({
            type: 'warning',
            message: `${resource.kind} has no configured fields`,
            field: `resources[${index}]`,
            suggestion: 'Configure fields for this resource or remove it'
          })
        }

        // Check for required fields
        const hasRequiredFields = resource.selectedFields?.some(field => field.required)
        if (!hasRequiredFields) {
          results.push({
            type: 'info',
            message: `${resource.kind} has no required fields selected`,
            field: `resources[${index}]`,
            suggestion: 'Consider including required fields for better template usability'
          })
        }
      })
    }

    // Success validation
    if (results.filter(r => r.type === 'error').length === 0) {
      results.push({
        type: 'success',
        message: 'Template validation passed! Ready to generate Helm chart.'
      })
    }

    setValidationResults(results)
    const isValid = results.filter(r => r.type === 'error').length === 0
    onValidationChange(isValid, results)
    setIsValidating(false)
  }

  useEffect(() => {
    validateTemplate()
  }, [template])

  const getIcon = (type: ValidationResult['type']) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info': return <Info className="h-4 w-4 text-blue-500" />
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  const getAlertVariant = (type: ValidationResult['type']) => {
    switch (type) {
      case 'error': return 'destructive'
      case 'warning': return 'default'
      case 'info': return 'default'
      case 'success': return 'default'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Template Validation
          {isValidating && <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {validationResults.map((result, index) => (
          <Alert key={index} variant={getAlertVariant(result.type)} className="flex items-start gap-3">
            {getIcon(result.type)}
            <div className="flex-1">
              <AlertDescription>
                <div className="font-medium">{result.message}</div>
                {result.field && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {result.field}
                  </Badge>
                )}
                {result.suggestion && (
                  <div className="text-sm text-gray-600 mt-1 italic">
                    💡 {result.suggestion}
                  </div>
                )}
              </AlertDescription>
            </div>
          </Alert>
        ))}
        
        <Button
          variant="outline"
          size="sm"
          onClick={validateTemplate}
          disabled={isValidating}
          className="w-full mt-4"
        >
          {isValidating ? 'Validating...' : 'Re-validate Template'}
        </Button>
      </CardContent>
    </Card>
  )
}