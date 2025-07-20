import { useTheme } from '@/renderer/components/theme-provider'
import { oneDark } from '@codemirror/theme-one-dark'
import { jsonTheme, jsonLightTheme, yamlLightTheme, getJsonExtensions, getYamlExtensions } from '@/renderer/lib/codemirror-themes'
import { getSyntaxHighlighterTheme, getSyntaxHighlighterCustomStyle, getSyntaxHighlighterLineNumberStyle } from '@/renderer/lib/syntax-highlighter-themes'

/**
 * Custom hook to get theme-appropriate editor configurations
 * @returns Object containing theme-aware editor configurations
 */
export const useEditorTheme = () => {
  const { theme } = useTheme()
  
  // Determine if current theme is dark
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  return {
    isDark,
    // CodeMirror themes
    codeMirrorTheme: isDark ? oneDark : yamlLightTheme,
    jsonCodeMirrorTheme: isDark ? jsonTheme : jsonLightTheme,
    
    // CodeMirror extensions
    jsonExtensions: getJsonExtensions(isDark),
    yamlExtensions: getYamlExtensions(isDark),
    
    // React Syntax Highlighter
    syntaxHighlighterTheme: getSyntaxHighlighterTheme(isDark),
    syntaxHighlighterCustomStyle: getSyntaxHighlighterCustomStyle(isDark),
    syntaxHighlighterLineNumberStyle: getSyntaxHighlighterLineNumberStyle(isDark),
  }
}