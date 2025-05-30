import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"

// Custom JSON theme with purple/pink accent colors (consistent with other editors)
export const jsonTheme = EditorView.theme({
  "&": {
    color: "#f8f8f2",
    backgroundColor: "#1a1a2e",
  },
  ".cm-content": {
    padding: "16px",
    caretColor: "#f8f8f0",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-editor": {
    borderRadius: "0",
  },
  ".cm-scroller": {
    fontFamily: "Fira Code, Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
  },
  ".cm-gutters": {
    backgroundColor: "#16213e",
    color: "#6272a4",
    border: "none",
  },
  ".cm-lineNumbers": {
    color: "#6272a4",
  },
  ".cm-activeLine": {
    backgroundColor: "#44475a40",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#44475a40",
  },
  ".cm-selectionMatch": {
    backgroundColor: "#44475a",
  },
  ".cm-searchMatch": {
    backgroundColor: "#ffb86c40",
    outline: "1px solid #ffb86c",
  },
  ".cm-cursor": {
    borderLeftColor: "#f8f8f0",
  },
  ".cm-selection": {
    backgroundColor: "#44475a",
  },
})

export const jsonHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#ff79c6" },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: "#8be9fd" },
  { tag: [t.function(t.variableName), t.labelName], color: "#50fa7b" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#bd93f9" },
  { tag: [t.definition(t.name), t.separator], color: "#f8f8f2" },
  {
    tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
    color: "#ffb86c",
  },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#ff79c6" },
  { tag: [t.meta, t.comment], color: "#6272a4" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#8be9fd", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#bd93f9" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#bd93f9" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#f1fa8c" },
  { tag: t.invalid, color: "#ff5555" },
])

// Base theme for consistent styling
const baseEditorTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
  },
  ".cm-content": {
    padding: "16px",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-editor": {
    borderRadius: "0",
  },
})

// CodeMirror extensions for read-only display
export const readOnlyExtensions = [baseEditorTheme, EditorView.editable.of(false)]

// JSON-specific read-only extensions
export const jsonReadOnlyExtensions = [
  baseEditorTheme,
  EditorView.editable.of(false),
  syntaxHighlighting(jsonHighlightStyle),
]
