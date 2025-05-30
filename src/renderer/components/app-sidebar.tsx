"use client"

import type * as React from "react"
import {
  Settings2,
  Monitor,
  Code,
  FileText,
  Key,
  BarChart3,
  FileCode,
  Archive,
  Boxes,
  GitBranch,
  FolderGit2,
  Settings,
  FolderOpen,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/renderer/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"
import KubernetesContextSelector from "@/renderer/components/kubernetes-context-selector"

type UserRole = "developer" | "devops" | "operations"
type ViewType =
  | "schema"
  | "values"
  | "secrets"
  | "chart-builder"
  | "template-editor"
  | "oci-registry"
  | "kubernetes"
  | "argocd"
  | "git-repos"
  | "file-explorer"
  | "settings"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userRole: UserRole
  setUserRole: (role: UserRole) => void
  view: ViewType
  setView: (view: ViewType) => void
  environment: string
  setEnvironment: (env: string) => void
  kubernetesContext: string
  setKubernetesContext: (context: string) => void
  onSaveContext: () => void
}

const roleItems = [
  {
    title: "Developer",
    icon: Code,
    role: "developer" as UserRole,
  },
  {
    title: "DevOps/Platform",
    icon: Settings2,
    role: "devops" as UserRole,
  },
  {
    title: "Operations",
    icon: Monitor,
    role: "operations" as UserRole,
  },
]

const developerTools = [
  {
    title: "Schema Editor",
    icon: FileText,
    view: "schema" as ViewType,
  },
  {
    title: "Values Editor",
    icon: FileCode,
    view: "values" as ViewType,
  },
  {
    title: "Secrets Editor",
    icon: Key,
    view: "secrets" as ViewType,
  },
  {
    title: "Chart Builder",
    icon: BarChart3,
    view: "chart-builder" as ViewType,
  },
  {
    title: "Template Editor",
    icon: FileText,
    view: "template-editor" as ViewType,
  },
  {
    title: "OCI Registry",
    icon: Archive,
    view: "oci-registry" as ViewType,
  },
]

const devopsTools = [
  {
    title: "Kubernetes",
    icon: Boxes,
    view: "kubernetes" as ViewType,
  },
  {
    title: "ArgoCD",
    icon: GitBranch,
    view: "argocd" as ViewType,
  },
  {
    title: "Git Repositories",
    icon: FolderGit2,
    view: "git-repos" as ViewType,
  },
]

const operationsTools = [
  {
    title: "Values Editor",
    icon: FileCode,
    view: "values" as ViewType,
  },
  {
    title: "Secrets Editor",
    icon: Key,
    view: "secrets" as ViewType,
  },
]

export function AppSidebar({
  userRole,
  setUserRole,
  view,
  setView,
  environment,
  setEnvironment,
  kubernetesContext,
  setKubernetesContext,
  onSaveContext,
  ...props
}: AppSidebarProps) {
  const { toggleSidebar } = useSidebar()

  const getToolsForRole = () => {
    switch (userRole) {
      case "developer":
        return developerTools
      case "devops":
        return devopsTools
      case "operations":
        return operationsTools
      default:
        return []
    }
  }

  const getSectionTitle = () => {
    switch (userRole) {
      case "developer":
        return "DEVELOPER TOOLS"
      case "devops":
        return "DEVOPS TOOLS"
      case "operations":
        return "OPERATIONS TOOLS"
      default:
        return "TOOLS"
    }
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              onClick={toggleSidebar}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-yellow-500 text-white font-bold">
                CP
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">ConfigPilot</span>
                <span className="truncate text-xs">Configuration Management</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Kubernetes Context Selection */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>KUBERNETES CONTEXT</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2">
              <KubernetesContextSelector
                onContextChange={setKubernetesContext}
                initialContext={kubernetesContext}
                showLabel={false}
                className="w-full"
              />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Role Selection */}
        <SidebarGroup>
          <SidebarGroupLabel>ROLE</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {roleItems.map((item) => (
                <SidebarMenuItem key={item.role}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={userRole === item.role}
                    onClick={() => setUserRole(item.role)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools based on role */}
        <SidebarGroup>
          <SidebarGroupLabel>{getSectionTitle()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getToolsForRole().map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={view === item.view}
                    onClick={() => setView(item.view)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* File Explorer */}
        <SidebarGroup>
          <SidebarGroupLabel>FILE EXPLORER</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="File Explorer"
                  isActive={view === "file-explorer"}
                  onClick={() => setView("file-explorer")}
                >
                  <FolderOpen />
                  <span>File Explorer</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>SETTINGS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Settings"
                  isActive={view === "settings"}
                  onClick={() => setView("settings")}
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>ENVIRONMENT</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2">
              <Select
                value={environment}
                onValueChange={(value) => {
                  setEnvironment(value)
                  onSaveContext()
                  console.log("Environment changed to:", value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="sit">System Integration</SelectItem>
                  <SelectItem value="uat">User Acceptance</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
