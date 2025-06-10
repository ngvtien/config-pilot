import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { DescriptionTooltip } from "/@renderer/components/ui/description-tooltip";

export function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const { title, schema, properties, required } = props;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1 mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {required && <span className="text-red-500 ml-1">*</span>}
        <DescriptionTooltip description={schema.description} />
      </div>
      <div className="space-y-4">{properties.map((p) => p.content)}</div>
    </div>
  );
}
