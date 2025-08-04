import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

/**
 * Get the appropriate syntax highlighter theme based on the current theme
 * @param isDark - Whether the current theme is dark
 * @returns The appropriate syntax highlighter theme
 */
export const getSyntaxHighlighterTheme = (isDark: boolean) => {
  return isDark ? vscDarkPlus : vs
}

/**
 * Get custom style overrides for syntax highlighter based on theme
 * @param isDark - Whether the current theme is dark
 * @returns Custom style object
 */
export const getSyntaxHighlighterCustomStyle = (isDark: boolean) => {
  return {
    margin: 0,
    padding: '1rem',
    background: isDark ? '#1e1e1e' : '#ffffff', // VS Code dark background
    fontSize: '14px',
    lineHeight: '1.5',
    border: isDark ? '1px solid #3c3c3c' : '1px solid #e5e7eb', // VS Code border colors
  }
}

/**
 * Get line number style based on theme
 * @param isDark - Whether the current theme is dark
 * @returns Line number style object
 */
export const getSyntaxHighlighterLineNumberStyle = (isDark: boolean) => {
  return {
    minWidth: '3em',
    paddingRight: '1em',
    color: isDark ? '#858585' : '#237893', // VS Code line number colors
    borderRight: isDark ? '1px solid #3c3c3c' : '1px solid #e5e7eb',
    marginRight: '1em'
  }
}