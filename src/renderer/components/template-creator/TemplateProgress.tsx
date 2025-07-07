import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Badge } from '@/renderer/components/ui/badge'
import { Progress } from '@/renderer/components/ui/progress'
import { CheckCircle, Circle, AlertCircle } from 'lucide-react'
import { Template } from '@/shared/types/template'

interface TemplateProgressProps {
  template: Template
  currentStep: number
  onStepClick: (step: number) => void
}

export function TemplateProgress({ template, currentStep, onStepClick }: TemplateProgressProps) {
  const steps = [
    {
      id: 1,
      title: 'Template Info',
      description: 'Name and description',
      isComplete: !!(template.name && template.description),
      isRequired: true
    },
    {
      id: 2,
      title: 'Add Resources',
      description: 'Select Kubernetes resources',
      isComplete: !!(template.resources && template.resources.length > 0),
      isRequired: true
    },
    {
      id: 3,
      title: 'Configure Fields',
      description: 'Select and configure resource fields',
      isComplete: !!(template.resources?.every(r => r.selectedFields && r.selectedFields.length > 0)),
      isRequired: true
    },
    {
      id: 4,
      title: 'Validate & Generate',
      description: 'Review and generate Helm chart',
      isComplete: false, // This would be determined by validation
      isRequired: true
    }
  ]

  const completedSteps = steps.filter(step => step.isComplete).length
  const progressPercentage = (completedSteps / steps.length) * 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Template Progress</span>
          <Badge variant="outline">
            {completedSteps}/{steps.length} Complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const isCurrent = currentStep === step.id
            const isClickable = step.id <= currentStep + 1
            
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  isCurrent 
                    ? 'border-blue-200 bg-blue-50' 
                    : step.isComplete 
                    ? 'border-green-200 bg-green-50 hover:bg-green-100' 
                    : 'border-gray-200 hover:bg-gray-50'
                } ${!isClickable ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => isClickable && onStepClick(step.id)}
              >
                <div className="flex-shrink-0">
                  {step.isComplete ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : isCurrent ? (
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className={`font-medium ${
                    step.isComplete ? 'text-green-800' :
                    isCurrent ? 'text-blue-800' : 'text-gray-700'
                  }`}>
                    {step.title}
                  </div>
                  <div className="text-sm text-gray-600">
                    {step.description}
                  </div>
                </div>
                
                {step.isRequired && (
                  <Badge variant="outline" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}