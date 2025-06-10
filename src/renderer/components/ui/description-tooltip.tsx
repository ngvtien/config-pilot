import { Info } from 'lucide-react'
import { Tooltip } from '@/renderer/components/ui/tooltip'

/**
 * Reusable tooltip component for displaying field descriptions
 * Shows an info icon that displays the description on hover
 */
export function DescriptionTooltip({ description }: { description?: string }) {
  if (!description) return null;

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button className="text-gray-400 hover:text-gray-600 ml-1">
            <Info className="h-4 w-4" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={4}
            className="max-w-xs p-2 text-sm bg-gray-800 text-white rounded shadow-lg"
          >
            {description}
            <Tooltip.Arrow className="fill-gray-800" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}