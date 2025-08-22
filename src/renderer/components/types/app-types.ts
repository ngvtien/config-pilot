/**
 * User roles available in the application
 */
export type UserRole = "developer" | "devops" | "operations"

/**
 * Available view types for different application sections
 */
export type ViewType =
  | "schema"
  | "values"
  | "secrets"
  | "chart-builder"
  | "template-editor"
  | "template-library"
  | "oci-registry"
  | "kubernetes"
  | "k8s-resources"
  | "k8s-dashboard"
  | "argocd"
  | "git-repos"
  //| "file-explorer"
  | "settings"
  | "project-composer"
  | "customer-management"
  | "product-management"
  | "workspace-demo"
  | "product-workspace"

/**
 * Role-based tool configuration
 */
export interface RoleToolConfig {
  title: string
  icon: any
  view: ViewType
  roles: UserRole[]
}

/**
 * Application context data structure
 */
export interface AppContextData {
  userRole: UserRole
  currentView: ViewType
  environment: string
  kubernetesContext: string
}