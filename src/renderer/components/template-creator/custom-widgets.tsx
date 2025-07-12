import type { WidgetProps, ObjectFieldTemplateProps, ArrayFieldTemplateProps } from "@rjsf/utils";
import { DescriptionTooltip } from '@/renderer/components/ui/description-tooltip'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Plus, Trash2 } from "lucide-react";


/**
 * Custom text widget with tooltip support
 * Handles string and number input fields
 */
export function TextWidget(props: WidgetProps) {
  const { id, value, onChange } = props;

  return (
    <input
      type={props.type || "text"}
      id={id}
      value={value ?? ""}
      onChange={(e) => {
        const newValue = props.type === 'number' ? parseFloat(e.target.value) || undefined : e.target.value
        onChange(newValue)
      }}
      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
    />
  );
}

/**
 * Custom textarea widget with tooltip support
 * Used for multiline string fields
 */
export function TextareaWidget(props: WidgetProps) {
  const { id, value, onChange } = props

  return (
    <Textarea
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-h-[100px]"
    />
  )
}

/**
 * Custom checkbox widget with tooltip support
 * Used for boolean fields
 */
export function CheckboxWidget(props: WidgetProps) {
  const { id, value, onChange } = props

  return (
    <input
      type="checkbox"
      id={id}
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
    />
  )
}

/**
 * Custom select widget with tooltip support
 * Used for enum fields
 */
export function SelectWidget(props: WidgetProps) {
  const { id, options, value, onChange } = props;
  const { enumOptions } = options;

  return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
      >
        {enumOptions?.map(({ value, label }: { value: string; label: string }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
  )
}

export function ObjectField(props: ObjectFieldTemplateProps) {
  return (
    <div className="space-y-4">
      {props.properties.map((prop: any) => prop.content)}
    </div>
  );
}

export function ArrayField(props: ArrayFieldTemplateProps) {
  const { 
    title, 
    required, 
    items, 
    onAddClick, 
  } = props;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1">
        <label className="block text-sm font-medium text-gray-700">
          {title}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>

      {items &&
        items.map(({ key, children }, index) => (
          <div key={key} className="mt-2 flex items-center gap-2">
            {children}
            <button
              type="button"
              // onClick={() => onDropIndexClick(index)()}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

      <button
        type="button"
        onClick={onAddClick}
        className="mt-2 flex items-center text-sm text-amber-600 hover:text-amber-800"
      >
        <Plus className="mr-1 h-4 w-4" /> Add Item
      </button>
    </div>
  );
}