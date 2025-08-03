"use client"

import React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { linter, lintGutter } from "@codemirror/lint"
import { jsonParseLinter } from "@codemirror/lang-json"
import { useTheme } from '@/renderer/components/theme-provider'
import { EditorView } from "@codemirror/view"
import { syntaxHighlighting } from "@codemirror/language"
import { jsonHighlightStyle, jsonLightHighlightStyle } from "@/renderer/lib/codemirror-themes"

interface JsonEditorProps {
  /** The JSON string value to display in the editor */
  value: string
  /** Callback function called when the editor content changes */
  onChange: (value: string) => void
  /** Optional CSS class name for the editor container */
  className?: string
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Placeholder text when editor is empty */
  placeholder?: string
  /** Height of the editor, defaults to "100%" */
  height?: string
  /** Width of the editor, defaults to "100%" */
  width?: string
  /** Basic setup extensions to include */
  basicSetup?: boolean | {
    lineNumbers?: boolean
    foldGutter?: boolean
    dropCursor?: boolean
    allowMultipleSelections?: boolean
    indentOnInput?: boolean
    bracketMatching?: boolean
    closeBrackets?: boolean
    autocompletion?: boolean
    highlightSelectionMatches?: boolean
    searchKeymap?: boolean
  }
}

/**
 * A reusable JSON editor component built on CodeMirror using @uiw/react-codemirror
 * Features:
 * - JSON syntax highlighting and validation
 * - Automatic theme switching (light/dark mode)
 * - Automatic linting with error indicators
 * - Consistent theming with the rest of the application
 * - Full height layout support
 * - Proper read-only control without forced extensions
 */
export const JsonEditor = React.memo<JsonEditorProps>(
  ({ 
    value, 
    onChange, 
    className = "", 
    readOnly = false, 
    placeholder,
    height = "100%",
    width = "100%",
    basicSetup = {
      lineNumbers: true,
      foldGutter: true,
      dropCursor: false,
      allowMultipleSelections: true,
      indentOnInput: true,
      bracketMatching: true,
      closeBrackets: true,
      autocompletion: true,
      highlightSelectionMatches: false,
      searchKeymap: true,
    }
  }) => {
    const { theme } = useTheme()
    
    // Determine if current theme is dark
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    // Build extensions array without problematic jsonExtensions
    const extensions = React.useMemo(() => {
      const exts = [
        json(),
        // Custom theme setup without forced read-only
        EditorView.theme({
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
        }),
        // Apply proper syntax highlighting based on theme
        syntaxHighlighting(isDark ? jsonHighlightStyle : jsonLightHighlightStyle),
      ]

      // Add linting only if not read-only
      if (!readOnly) {
        exts.push(linter(jsonParseLinter()), lintGutter())
      }

      // Only add read-only extension if explicitly requested
      if (readOnly) {
        exts.push(EditorView.editable.of(false))
      }

      return exts
    }, [readOnly, isDark])

    return (
      <div className={`h-full w-full rounded-lg border overflow-hidden ${className}`}>
        <CodeMirror
          value={value}
          height={height}
          width={width}
          extensions={extensions}
          onChange={onChange}
          theme={theme === 'dark' ? 'dark' : 'light'}
          readOnly={readOnly}
          placeholder={placeholder}
          basicSetup={basicSetup}
          data-testid="json-editor"
        />
      </div>
    )
  }
)

JsonEditor.displayName = "JsonEditor"