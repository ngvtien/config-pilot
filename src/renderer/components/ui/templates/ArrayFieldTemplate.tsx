import type { ArrayFieldTemplateProps } from "@rjsf/utils";
import { DescriptionTooltip } from "/@renderer/components/ui/description-tooltip";

export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const { schema, title, items, canAdd, onAddClick, required } = props;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1 mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {required && <span className="text-red-500 ml-1">*</span>}
        <DescriptionTooltip description={schema.description} />
      </div>
      <div className="space-y-2">
        {items.map((element) => (
          <div key={element.key}>{element.children}</div>
        ))}
      </div>
      {canAdd && (
        <button
          type="button"
          onClick={onAddClick}
          className="mt-2 px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600"
        >
          Add Item
        </button>
      )}
    </div>
  );
}
