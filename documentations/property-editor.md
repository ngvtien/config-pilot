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
