## Schema Property Editor
In the context of the selected field from the resource schema let break them into chunk and address each type or group of type one by one.

Current closest implemtation on some of these are in `schema-editor.tsx`

1. primitive type without format option (mainly string and boolean??)
1.1. `title`, `description` and `default` value option 

2. primitive type without format option (mainly number, date, time? etc)
2.1. `title`, `description`, `default` value and `format` option

3. object type
3.1. object type without properties
3.1.1 should be treated as keyvalue pair and so  the editor would need to allow addit a set of `name` and `value`

3.2. object type with properties
3.2.1 straigh forward, editor would need to allow those property and its type to be inputable base on their type

4. Array of any of the above types
4.1. basically allow the  above types to be added to an array

5. Enum (as special version of array type?)
5.1. need to take enun type (string, number, etc) base on [JSONSchema7](https://jsonforms.io/api/core/interfaces/jsonschema7.html) 

## where to persist these info
the data would need to be persist in the filtered schema of each selectd k8x resource.

---

🚨 CRITICAL ISSUES I NEED TO CLARIFY BEFORE IMPLEMENTATION:
1. SchemaProperty Interface Inconsistency
There are multiple conflicting definitions of SchemaProperty across the codebase:

/shared/types/schema.ts: Missing name, path, title, format, default, enum
SchemaFieldSelectionModal.tsx: Has name, path, format, enum but different structure
schema-editor.tsx: Has title, default, enum but missing name, path
FieldConfigurationPanel.tsx: Uses title, format, constraints, default
❓ QUESTION: Which SchemaProperty interface should be the source of truth? This is critical because the enhanced property editor expects specific properties that may not exist.

2. Data Persistence Location Unclear
The documentation mentions "persist in the filtered schema of each selected k8s resource" but:

❓ QUESTION: Where exactly should the edited property data be saved?

In the original schema files?
In a separate configuration file?
In memory only?
In the template configuration?
3. Current Enhanced Property Editor Has Bugs
I found these issues in the current implementation:

Duplicate function definition in renderArrayItemEditor (lines 353-380 have duplicate code)
Missing properties in SchemaProperty interface (name, path, title, format)
Type mismatches between different SchemaProperty definitions
4. Implementation Strategy Questions
❓ QUESTIONS:

Should I fix the existing enhanced-property-editor.tsx or create a new component?
Should I update the SchemaProperty interface in /shared/types/schema.ts to include all needed properties?
Do you want me to focus only on point 1 (primitive types: string/boolean with title, description, default) or implement a more comprehensive solution?
Should I remove the duplicate code and fix the existing bugs first?
5. Testing Strategy
❓ QUESTION: Do you want me to:

Fix the existing tests in enhanced-property-editor.test.tsx?
Create new tests for the specific functionality?
Focus on manual testing to move quickly?