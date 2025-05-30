/**
 * Utility functions for handling file paths in a cross-platform way
 */

/**
 * Checks if a path is a UNC path (starts with \\)
 * @param path - The path to check
 * @returns True if the path is a UNC path
 */
export function isUncPath(path: string): boolean {
  return path.startsWith("\\\\")
}

/**
 * Normalizes a file path to use the correct separator for the current OS
 * @param path - The path to normalize
 * @returns The normalized path
 */
export function normalizePath(path: string): string {
  if (typeof window !== "undefined" && window.electronAPI) {
    // In Electron, we can detect the platform
    const isWindows = navigator.platform.toLowerCase().includes("win")
    const separator = isWindows ? "\\" : "/"

    // Handle UNC paths specially - preserve the leading \\
    if (isUncPath(path)) {
      // For UNC paths, preserve the \\ prefix and normalize the rest
      const uncPrefix = "\\\\"
      const restOfPath = path.substring(2)
      return uncPrefix + restOfPath.replace(/[/\\]/g, separator)
    }

    // Replace all separators with the correct one for this OS
    return path.replace(/[/\\]/g, separator)
  }

  // In web environment, default to forward slashes
  return path.replace(/\\/g, "/")
}

/**
 * Joins path segments using the correct separator for the current OS
 * @param segments - Path segments to join
 * @returns The joined path
 */
export function joinPath(...segments: string[]): string {
  if (typeof window !== "undefined" && window.electronAPI) {
    const isWindows = navigator.platform.toLowerCase().includes("win")
    const separator = isWindows ? "\\" : "/"

    // Check if the first segment is a UNC path
    const firstSegment = segments[0] || ""
    const isFirstUncPath = isUncPath(firstSegment)

    if (isFirstUncPath) {
      // Handle UNC paths specially
      const uncPrefix = "\\\\"
      const firstSegmentWithoutPrefix = firstSegment.substring(2)
      const allSegments = [firstSegmentWithoutPrefix, ...segments.slice(1)]

      const joinedPath = allSegments
        .map((segment) => segment.replace(/[/\\]/g, separator))
        .join(separator)
        .replace(new RegExp(`\\${separator}+`, "g"), separator) // Remove duplicate separators

      return uncPrefix + joinedPath
    }

    // Normal path joining
    return segments
      .map((segment) => segment.replace(/[/\\]/g, separator))
      .join(separator)
      .replace(new RegExp(`\\${separator}+`, "g"), separator) // Remove duplicate separators
  }

  // In web environment, default to forward slashes
  return segments
    .map((segment) => segment.replace(/\\/g, "/"))
    .join("/")
    .replace(/\/+/g, "/") // Remove duplicate separators
}

/**
 * Gets the appropriate path separator for the current OS
 * @returns The path separator ('\\' for Windows, '/' for others)
 */
export function getPathSeparator(): string {
  if (typeof window !== "undefined" && window.electronAPI) {
    const isWindows = navigator.platform.toLowerCase().includes("win")
    return isWindows ? "\\" : "/"
  }

  return "/"
}

/**
 * Builds a configuration file path using the correct separators
 * @param baseDirectory - The base directory (can be UNC path)
 * @param customer - Customer name
 * @param environment - Environment name
 * @param instance - Instance number
 * @param product - Product name
 * @param filename - The filename (e.g., 'values.yaml', 'secrets.yaml', 'values.schema.json')
 * @returns The complete file path
 */
export function buildConfigPath(
  baseDirectory: string,
  customer: string,
  environment: string,
  instance: string | number,
  product: string,
  filename: string,
): string {
  return normalizePath(joinPath(baseDirectory, customer, environment, String(instance), product, filename))
}

/**
 * Truncates a path for display purposes while preserving important parts
 * @param path - The path to truncate
 * @param maxLength - Maximum length for the displayed path
 * @returns The truncated path with ellipsis if needed
 */
export function truncatePath(path: string, maxLength = 80): string {
  if (path.length <= maxLength) {
    return path
  }

  // For UNC paths, preserve the UNC prefix and server name
  if (isUncPath(path)) {
    const parts = path.split(/[/\\]/)
    if (parts.length >= 3) {
      const uncPrefix = `\\\\${parts[2]}` // \\server
      const filename = parts[parts.length - 1]
      const remaining = maxLength - uncPrefix.length - filename.length - 5 // 5 for "...\"

      if (remaining > 0) {
        return `${uncPrefix}\\...\\${filename}`
      }
    }
  }

  // For regular paths, show beginning and end
  const separator = getPathSeparator()
  const parts = path.split(/[/\\]/)
  const filename = parts[parts.length - 1]
  const beginning = parts.slice(0, 2).join(separator) // Show first two parts

  const remaining = maxLength - beginning.length - filename.length - 5 // 5 for "...\"
  if (remaining > 0) {
    return `${beginning}${separator}...${separator}${filename}`
  }

  // If still too long, just show filename with ellipsis
  return `...${separator}${filename}`
}
