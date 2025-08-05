export const typography = {
  tile: {
    title: 'text-sm font-medium antialiased tracking-tight',
    subtitle: 'text-xs text-muted-foreground antialiased tracking-normal',
    badge: 'text-xs antialiased font-medium tracking-wide',
    metadata: 'text-xs text-muted-foreground antialiased tracking-normal',
    icon: 'text-lg antialiased',
  },
  card: {
    title: 'text-base font-semibold antialiased tracking-tight',
    subtitle: 'text-sm text-muted-foreground antialiased tracking-normal', 
    badge: 'text-xs antialiased font-medium tracking-wide',
    metadata: 'text-xs text-muted-foreground antialiased tracking-normal',
    icon: 'text-xl antialiased',
  },
  // Professional text utilities like VS Code
  utils: {
    sharpText: 'antialiased font-feature-settings-liga-calt tracking-tight',
    body: 'text-sm antialiased leading-relaxed tracking-normal font-normal',
    bodyLarge: 'text-base antialiased leading-relaxed tracking-tight font-normal',
    heading: 'font-semibold antialiased tracking-tight',
    headingLarge: 'font-bold antialiased tracking-tight',
    mono: 'font-mono antialiased tracking-normal font-feature-settings-liga-calt',
    caption: 'text-xs antialiased tracking-normal text-muted-foreground',
    label: 'text-sm font-medium antialiased tracking-normal',
  },
  // VS Code-inspired text styles
  editor: {
    text: 'font-mono text-sm antialiased leading-relaxed tracking-normal',
    lineNumbers: 'font-mono text-xs antialiased text-muted-foreground tracking-normal',
    keywords: 'font-mono text-sm antialiased font-medium tracking-normal',
  }
} as const

/**
 * Get consistent text classes for crispy font rendering
 * @param variant - Typography variant to use
 * @returns CSS classes string
 */
export const getTextClasses = (variant: keyof typeof typography) => {
  return typography[variant]
}

/**
 * Apply VS Code-like font rendering to any element
 * @param element - Typography element type
 * @returns CSS classes for crispy text rendering
 */
export const getCrispyTextClasses = (element: 'body' | 'heading' | 'mono' | 'caption' | 'label' = 'body') => {
  return typography.utils[element]
}