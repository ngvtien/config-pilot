import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'

/**
 * Reusable tooltip component for displaying field descriptions
 * Shows an info icon that displays the description on hover
 */
export function DescriptionTooltip({ description }: { description?: string }) {
  if (!description) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            type="button" 
            className="text-gray-400 hover:text-gray-600 ml-1 focus:outline-none"
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          align="center" 
          sideOffset={4}
          className="max-w-xs p-2 text-sm bg-gray-800 text-white rounded shadow-lg"
        >
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}