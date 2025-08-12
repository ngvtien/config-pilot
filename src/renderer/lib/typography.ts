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
  dialog: {
    title: 'text-lg font-semibold antialiased tracking-tight',
    subtitle: 'text-sm text-muted-foreground antialiased tracking-normal',
  },
  // Panel-specific typography for 3-panel layout
  panel: {
    title: 'text-lg font-semibold antialiased tracking-tight',
    subtitle: 'text-sm text-muted-foreground antialiased tracking-normal',
    sectionTitle: 'text-base font-medium antialiased tracking-tight',
    sectionSubtitle: 'text-sm text-muted-foreground antialiased tracking-normal',
    header: 'text-xl font-bold antialiased tracking-tight',
    subheader: 'text-base text-muted-foreground antialiased tracking-normal',
  },
  // Navigation typography
  navigation: {
    primary: 'text-sm font-medium antialiased tracking-normal',
    secondary: 'text-xs text-muted-foreground antialiased tracking-normal',
    breadcrumb: 'text-sm text-muted-foreground antialiased tracking-normal',
    tab: 'text-sm font-medium antialiased tracking-normal',
    activeTab: 'text-sm font-semibold antialiased tracking-normal',
  },
  // Form and input typography
  form: {
    label: 'text-sm font-medium antialiased tracking-normal',
    input: 'text-sm antialiased tracking-normal',
    placeholder: 'text-sm text-muted-foreground antialiased tracking-normal',
    error: 'text-xs text-destructive antialiased tracking-normal',
    helper: 'text-xs text-muted-foreground antialiased tracking-normal',
    required: 'text-xs text-destructive antialiased tracking-normal',
  },
  // Button typography
  button: {
    primary: 'text-sm font-medium antialiased tracking-normal',
    secondary: 'text-sm font-medium antialiased tracking-normal',
    ghost: 'text-sm font-medium antialiased tracking-normal',
    link: 'text-sm font-medium antialiased tracking-normal underline-offset-4',
    icon: 'text-sm antialiased',
  },
  // Table typography
  table: {
    header: 'text-xs font-medium antialiased tracking-wide uppercase',
    cell: 'text-sm antialiased tracking-normal',
    caption: 'text-xs text-muted-foreground antialiased tracking-normal',
    rowAction: 'text-xs font-medium antialiased tracking-normal',
  },
  // Status typography with colors
  status: {
    success: 'text-xs font-medium antialiased tracking-normal text-green-600',
    warning: 'text-xs font-medium antialiased tracking-normal text-yellow-600',
    error: 'text-xs font-medium antialiased tracking-normal text-red-600',
    info: 'text-xs font-medium antialiased tracking-normal text-blue-600',
    neutral: 'text-xs font-medium antialiased tracking-normal text-muted-foreground',
  },
  // List typography
  list: {
    item: 'text-sm antialiased tracking-normal',
    itemActive: 'text-sm font-medium antialiased tracking-normal',
    itemSecondary: 'text-xs text-muted-foreground antialiased tracking-normal',
    group: 'text-xs font-medium antialiased tracking-wide uppercase text-muted-foreground',
  },
  // Tooltip typography
  tooltip: {
    text: 'text-xs antialiased tracking-normal',
    title: 'text-xs font-medium antialiased tracking-normal',
  },
  // Body text typography - NEW SECTION
  body: {
    xs: 'text-xs antialiased leading-relaxed tracking-normal font-normal',
    sm: 'text-sm antialiased leading-relaxed tracking-normal font-normal',
    base: 'text-base antialiased leading-relaxed tracking-normal font-normal',
    lg: 'text-lg antialiased leading-relaxed tracking-tight font-normal',
    xl: 'text-xl antialiased leading-relaxed tracking-tight font-normal',
  },
  // Heading typography - NEW SECTION
  heading: {
    xs: 'text-xs font-semibold antialiased tracking-tight',
    sm: 'text-sm font-semibold antialiased tracking-tight',
    base: 'text-base font-semibold antialiased tracking-tight',
    lg: 'text-lg font-semibold antialiased tracking-tight',
    xl: 'text-xl font-bold antialiased tracking-tight',
    '2xl': 'text-2xl font-bold antialiased tracking-tight',
    '3xl': 'text-3xl font-bold antialiased tracking-tight',
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
    emphasis: 'font-semibold antialiased tracking-tight',
    muted: 'text-muted-foreground antialiased tracking-normal',
  },
  // VS Code-inspired text styles
  editor: {
    text: 'font-mono text-xs antialiased leading-relaxed tracking-normal', // Changed from text-[15px] to text-xs
    lineNumbers: 'font-mono text-xs antialiased text-muted-foreground tracking-normal',
    keywords: 'font-mono text-xs antialiased font-medium tracking-normal', // Changed from text-[15px] to text-xs
    comments: 'font-mono text-xs antialiased text-muted-foreground tracking-normal', // Changed from text-[15px] to text-xs
    strings: 'font-mono text-xs antialiased tracking-normal', // Changed from text-[15px] to text-xs
    variables: 'font-mono text-xs antialiased font-medium tracking-normal', // Changed from text-[15px] to text-xs
  },  // Resource and YAML specific typography
  resource: {
    kind: 'text-sm font-semibold antialiased tracking-tight',
    name: 'text-sm font-medium antialiased tracking-normal',
    namespace: 'text-xs text-muted-foreground antialiased tracking-normal',
    status: 'text-xs font-medium antialiased tracking-normal',
    metadata: 'text-xs text-muted-foreground antialiased tracking-normal',
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
export const getCrispyTextClasses = (element: 'body' | 'heading' | 'mono' | 'caption' | 'label' | 'emphasis' | 'muted' = 'body') => {
  return typography.utils[element]
}

/**
 * Get typography classes for specific UI components
 * @param component - Component type
 * @param variant - Variant within the component
 * @returns CSS classes string
 */
export const getComponentTypography = <T extends keyof typeof typography>(
  component: T,
  variant: keyof typeof typography[T]
): string => {
  return typography[component][variant] as string
}

/**
 * Get status-specific typography with color
 * @param status - Status type
 * @returns CSS classes string with appropriate color
 */
export const getStatusTypography = (status: keyof typeof typography.status): string => {
  return typography.status[status]
}