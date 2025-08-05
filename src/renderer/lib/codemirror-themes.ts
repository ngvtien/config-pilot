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

export const jsonLightTheme = EditorView.theme({
  "&": {
    color: "#24292e",
    backgroundColor: "#ffffff",
  },
  ".cm-content": {
    padding: "16px",
    caretColor: "#24292e",
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
    backgroundColor: "#f6f8fa",
    color: "#6a737d",
    border: "none",
  },
  ".cm-lineNumbers": {
    color: "#6a737d",
  },
  ".cm-activeLine": {
    backgroundColor: "#f1f8ff",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#f1f8ff",
  },
  ".cm-selectionMatch": {
    backgroundColor: "#c8e1ff",
  },
  ".cm-searchMatch": {
    backgroundColor: "#ffdf5d",
    outline: "1px solid #d1b60a",
  },
  ".cm-cursor": {
    borderLeftColor: "#24292e",
  },
  ".cm-selection": {
    backgroundColor: "#c8e1ff",
  },
})

export const jsonLightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#d73a49" },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: "#005cc5" },
  { tag: [t.function(t.variableName), t.labelName], color: "#22863a" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#6f42c1" },
  { tag: [t.definition(t.name), t.separator], color: "#24292e" },
  {
    tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
    color: "#005cc5",
  },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#d73a49" },
  { tag: [t.meta, t.comment], color: "#6a737d" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#005cc5", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#6f42c1" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#6f42c1" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#032f62" },
  { tag: t.invalid, color: "#cb2431" },
])

// export const yamlLightTheme = EditorView.theme({
//   "&": {
//     color: "#24292e",
//     backgroundColor: "#ffffff",
//   },
//   ".cm-content": {
//     padding: "16px",
//     caretColor: "#24292e",
//   },
//   ".cm-focused": {
//     outline: "none",
//   },
//   ".cm-editor": {
//     borderRadius: "0",
//   },
//   ".cm-scroller": {
//     fontFamily: "Fira Code, Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
//   },
//   ".cm-gutters": {
//     backgroundColor: "#f6f8fa",
//     color: "#6a737d",
//     border: "none",
//   },
//   ".cm-lineNumbers": {
//     color: "#6a737d",
//   },
//   ".cm-activeLine": {
//     backgroundColor: "#f1f8ff",
//   },
//   ".cm-activeLineGutter": {
//     backgroundColor: "#f1f8ff",
//   },
//   ".cm-selectionMatch": {
//     backgroundColor: "#c8e1ff",
//   },
//   ".cm-searchMatch": {
//     backgroundColor: "#ffdf5d",
//     outline: "1px solid #d1b60a",
//   },
//   ".cm-cursor": {
//     borderLeftColor: "#24292e",
//   },
//   ".cm-selection": {
//     backgroundColor: "#c8e1ff",
//   },
// })

// export const yamlLightHighlightStyle = HighlightStyle.define([
//   { tag: t.keyword, color: "#d73a49" },
//   { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: "#005cc5" },
//   { tag: [t.function(t.variableName), t.labelName], color: "#22863a" },
//   { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#6f42c1" },
//   { tag: [t.definition(t.name), t.separator], color: "#24292e" },
//   {
//     tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
//     color: "#005cc5",
//   },
//   { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#d73a49" },
//   { tag: [t.meta, t.comment], color: "#6a737d" },
//   { tag: t.strong, fontWeight: "bold" },
//   { tag: t.emphasis, fontStyle: "italic" },
//   { tag: t.strikethrough, textDecoration: "line-through" },
//   { tag: t.link, color: "#005cc5", textDecoration: "underline" },
//   { tag: t.heading, fontWeight: "bold", color: "#6f42c1" },
//   { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#6f42c1" },
//   { tag: [t.processingInstruction, t.string, t.inserted], color: "#032f62" },
//   { tag: t.invalid, color: "#cb2431" },
// ])

export const yamlLightTheme = EditorView.theme({
  "&": {
    color: "#24292e",
    backgroundColor: "#ffffff",
    height: "100%", // Add height here
  },
  ".cm-content": {
    padding: "16px",
    caretColor: "#24292e",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-editor": {
    borderRadius: "0",
    height: "100%", // Add height here
  },
  ".cm-scroller": {
    fontFamily: "Fira Code, Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
    overflow: "auto", // Add overflow here
    maxHeight: "100%", // Add maxHeight here
  },
  ".cm-gutters": {
    backgroundColor: "#f6f8fa",
    color: "#6A9955", // Green line numbers like in your attachment
    border: "none",
  },
  ".cm-lineNumbers": {
    color: "#6A9955", // Green line numbers
  },
  ".cm-activeLine": {
    backgroundColor: "#f1f8ff",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#f1f8ff",
  },
  ".cm-selectionMatch": {
    backgroundColor: "#c8e1ff",
  },
  ".cm-searchMatch": {
    backgroundColor: "#ffdf5d",
    outline: "1px solid #d1b60a",
  },
  ".cm-cursor": {
    borderLeftColor: "#24292e",
  },
  ".cm-selection": {
    backgroundColor: "#c8e1ff",
  },
})

export const yamlLightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#d73a49" },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: "#D7BA7D" }, // Orange/amber for properties/keys (like in attachment)
  { tag: [t.function(t.variableName), t.labelName], color: "#22863a" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#6f42c1" },
  { tag: [t.definition(t.name), t.separator], color: "#24292e" },
  {
    tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
    color: "#005cc5",
  },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#d73a49" },
  { tag: [t.meta, t.comment], color: "#6a737d" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#005cc5", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#6f42c1" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#6f42c1" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#032f62" },
  { tag: t.invalid, color: "#cb2431" },
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

// Updated YAML dark theme to match VS Code with green line numbers
export const yamlDarkTheme = EditorView.theme({
  "&": {
    color: "#d4d4d4",
    backgroundColor: "#1e1e1e", // Match SyntaxHighlighter dark background
    height: "100%", // Add height here
  },
  ".cm-content": {
    padding: "16px",
    caretColor: "#d4d4d4",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-editor": {
    borderRadius: "0",
    height: "100%", // Add height here
  },
  ".cm-scroller": {
    fontFamily: "Fira Code, Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
    overflow: "auto", // Add overflow here
    maxHeight: "100%", // Add maxHeight here
  },
  ".cm-gutters": {
    backgroundColor: "#252526",
    color: "#6A9955", // Green line numbers like in your attachment
    border: "none",
  },
  ".cm-lineNumbers": {
    color: "#6A9955", // Green line numbers
  },
  ".cm-activeLine": {
    backgroundColor: "#2a2d2e",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#2a2d2e",
  },
  ".cm-selectionMatch": {
    backgroundColor: "#264f78",
  },
  ".cm-searchMatch": {
    backgroundColor: "#613214",
    outline: "1px solid #f9c513",
  },
  ".cm-cursor": {
    borderLeftColor: "#d4d4d4",
  },
  ".cm-selection": {
    backgroundColor: "#2b53e3 !important",
  },
  ".cm-editor .cm-selection": {
    backgroundColor: "#2b53e3 !important",
  },
  ".cm-editor.cm-focused .cm-selection": {
    backgroundColor: "#2b53e3 !important",
  },
  "&.cm-focused .cm-selection": {
    backgroundColor: "#2b53e3 !important",
  },
  ".cm-selectionLayer .cm-selection": {
    backgroundColor: "#2b53e3 !important",
  },
  // Add these new more specific selectors to override global ::selection
  ".dark & ::selection": {
    backgroundColor: "#2b53e3 !important",
  },
  ".dark & ::-moz-selection": {
    backgroundColor: "#2b53e3 !important",
  },
  // Target CodeMirror content specifically
  ".cm-content ::selection": {
    backgroundColor: "#2b53e3 !important",
  },
  ".cm-content ::-moz-selection": {
    backgroundColor: "#2b53e3 !important",
  },
  // Ultra-specific selector to override global .dark ::selection
  "html.dark & *::selection": {
    backgroundColor: "#2b53e3 !important",
  },
  "html.dark & *::-moz-selection": {
    backgroundColor: "#2b53e3 !important",
  },

})

export const yamlDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#569cd6" }, // Blue keywords
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: "#ce9178" },
  { tag: [t.function(t.variableName), t.labelName], color: "#dcdcaa" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#4ec9b0" },
  { tag: [t.definition(t.name), t.separator], color: "#d4d4d4" },
  // Specific mappings for numbers and booleans FIRST to ensure priority
  { tag: t.number, color: "#B5CEA8" }, // Light green for numbers - specific mapping
  { tag: t.bool, color: "#569CD6" }, // Light blue for booleans - specific mapping
  { tag: [t.literal, t.unit], color: "#B5CEA8" }, // For numeric literals and units
  { tag: [t.constant(t.bool)], color: "#569CD6" }, // For boolean constants
  // General type mappings WITHOUT t.number to avoid conflicts
  {
    tag: [t.typeName, t.className, t.changed, t.annotation, t.modifier, t.self, t.namespace],
    color: "#4ec9b0", // Cyan for other types (changed from #B5CEA8 to avoid number conflicts)
  },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#d7ba7d" },
  { tag: [t.meta, t.comment], color: "#6a9955" }, // Green comments
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#3794ff", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#569cd6" },
  { tag: [t.atom, t.special(t.variableName)], color: "#569CD6" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#ce9178" }, // Orange strings
  { tag: t.invalid, color: "#f44747" },
])

export const getJsonExtensions = (isDark: boolean) => [
  baseEditorTheme,
  EditorView.editable.of(false),
  syntaxHighlighting(isDark ? jsonHighlightStyle : jsonLightHighlightStyle),
]

export const getYamlExtensions = (isDark: boolean) => [
  baseEditorTheme,
  isDark ? yamlDarkTheme : yamlLightTheme, // Apply the specific YAML theme after base theme
  syntaxHighlighting(isDark ? yamlDarkHighlightStyle : yamlLightHighlightStyle),
]

// CodeMirror extensions for read-only display
export const readOnlyExtensions = [baseEditorTheme, EditorView.editable.of(false)]

// JSON-specific read-only extensions
export const jsonReadOnlyExtensions = [
  baseEditorTheme,
  EditorView.editable.of(false),
  syntaxHighlighting(jsonHighlightStyle),
]


