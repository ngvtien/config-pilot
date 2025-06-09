import { DescriptionTooltip } from '@/renderer/components/ui/description-tooltip'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Checkbox } from '@/renderer/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'

/**
 * Custom text widget with tooltip support
 * Handles string and number input fields
 */
export function TextWidget(props: any) {
  const { id, label, description, required, value, onChange, schema } = props
  const inputType = schema.type === 'number' ? 'number' : 'text'

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 mb-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <DescriptionTooltip description={description} />
      </div>
      <Input
        type={inputType}
        id={id}
        value={value ?? ''}
        onChange={(e) => {
          const newValue = inputType === 'number' ? parseFloat(e.target.value) || undefined : e.target.value
          onChange(newValue)
        }}
        className="w-full"
      />
    </div>
  )
}

/**
 * Custom textarea widget with tooltip support
 * Used for multiline string fields
 */
export function TextareaWidget(props: any) {
  const { id, label, description, required, value, onChange } = props

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 mb-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <DescriptionTooltip description={description} />
      </div>
      <Textarea
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[100px]"
      />
    </div>
  )
}

/**
 * Custom checkbox widget with tooltip support
 * Used for boolean fields
 */
export function CheckboxWidget(props: any) {
  const { id, label, description, value, onChange } = props

  return (
    <div className="mb-4 flex items-center space-x-2">
      <Checkbox
        id={id}
        checked={value || false}
        onCheckedChange={(checked) => onChange(checked)}
      />
      <div className="flex items-center">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <DescriptionTooltip description={description} />
      </div>
    </div>
  )
}

/**
 * Custom select widget with tooltip support
 * Used for enum fields
 */
export function SelectWidget(props: any) {
  const { id, label, description, required, value, onChange, options } = props

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 mb-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <DescriptionTooltip description={description} />
      </div>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent>
          {options.enumOptions?.map((option: any) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}