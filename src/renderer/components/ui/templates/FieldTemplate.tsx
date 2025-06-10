import type { FieldTemplateProps } from "@rjsf/utils";
import { DescriptionTooltip } from "/@renderer/components/ui/description-tooltip";

export function FieldTemplate(props: FieldTemplateProps) {
  const {
    id,
    label,
    required,
    schema,
    children,
    errors,
    help,
  } = props;

  const description = schema.description; // Always a string

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <DescriptionTooltip description={description} />
      </div>
      <div>{children}</div>
      {errors}
      {help}
    </div>
  );
}
