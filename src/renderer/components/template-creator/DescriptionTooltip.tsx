import React from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'

/**
 * Component to display schema field descriptions as tooltips
 * Based on the rjsf-tooltips-demo implementation
 */
export function DescriptionTooltip({ description }: { description?: string }) {
  if (!description) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="text-gray-400 hover:text-gray-600 ml-1 p-0.5">
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={4}
          className="max-w-xs p-2 text-sm"
        >
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}