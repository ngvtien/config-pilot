import React from "react"
import { ChevronUp, ChevronDown, Edit, Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/renderer/components/ui/button"
import { Checkbox } from "@/renderer/components/ui/checkbox"
import { Badge } from "@/renderer/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SecretItem, SortConfig, SecretVaultStatus } from "../types/secrets"

interface SecretsTableProps {
  secrets: SecretItem[]
  selectedSecrets: number[]
  sortConfig: SortConfig | null
  secretValues: Record<string, string>
  secretVaultStatuses: Record<string, SecretVaultStatus>
  onSelectSecret: (index: number) => void
  onSelectAll: () => void
  onSort: (key: string) => void
  onEditSecret: (index: number) => void
  onSaveToVault: (index: number) => void
}

/**
 * Table component for displaying and managing secrets
 */
export const SecretsTable: React.FC<SecretsTableProps> = ({
  secrets,
  selectedSecrets,
  sortConfig,
  secretValues,
  secretVaultStatuses,
  onSelectSecret,
  onSelectAll,
  onSort,
  onEditSecret,
  onSaveToVault
}) => {
  /**
   * Get sort indicator for table headers
   */
  const getSortIndicator = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null
    }
    return sortConfig.direction === "ascending" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  /**
   * Get vault status badge for a secret
   */
  const getVaultStatusBadge = (secretName: string) => {
    const status = secretVaultStatuses[secretName]
    if (!status) return null

    const statusConfig = {
      checking: { variant: "secondary" as const, text: "Checking..." },
      synced: { variant: "default" as const, text: "Synced" },
      'out-of-sync': { variant: "destructive" as const, text: "Out of Sync" },
      error: { variant: "destructive" as const, text: "Error" }
    }

    const config = statusConfig[status]
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.text}
      </Badge>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-12 p-3">
              <Checkbox
                checked={selectedSecrets.length === secrets.length && secrets.length > 0}
                onCheckedChange={onSelectAll}
              />
            </th>
            <th className="text-left p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort("name")}
                className="font-semibold hover:bg-transparent p-0 h-auto"
              >
                Secret Name
                {getSortIndicator("name")}
              </Button>
            </th>
            <th className="text-left p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort("path")}
                className="font-semibold hover:bg-transparent p-0 h-auto"
              >
                Vault Path
                {getSortIndicator("path")}
              </Button>
            </th>
            <th className="text-left p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort("key")}
                className="font-semibold hover:bg-transparent p-0 h-auto"
              >
                Vault Key
                {getSortIndicator("key")}
              </Button>
            </th>
            <th className="text-left p-3">Value</th>
            <th className="text-left p-3">Status</th>
            <th className="text-center p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {secrets.map((secret, index) => {
            const originalIndex = index // Adjust if needed for filtered/sorted arrays
            const hasValue = secretValues[secret.name]
            const isSelected = selectedSecrets.includes(originalIndex)

            return (
              <tr
                key={`${secret.name}-${index}`}
                className={cn(
                  "border-t transition-colors",
                  "hover:bg-muted/50 dark:hover:bg-muted/80",
                  isSelected && "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700"
                )}
              >
                <td className="p-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelectSecret(originalIndex)}
                  />
                </td>
                <td className="p-3">
                  <div className="font-medium">{secret.name || "Unnamed"}</div>
                </td>
                <td className="p-3">
                  <div className="text-sm text-muted-foreground font-mono">
                    {secret.vaultRef?.path || "Not configured"}
                  </div>
                </td>
                <td className="p-3">
                  <div className="text-sm text-muted-foreground font-mono">
                    {secret.vaultRef?.key || "Not configured"}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {hasValue ? (
                      <>
                        <Eye className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600">Has Value</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400">No Value</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  {getVaultStatusBadge(secret.name)}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditSecret(originalIndex)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {hasValue && secret.vaultRef?.path && secret.vaultRef?.key && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSaveToVault(originalIndex)}
                        className="h-8 w-8 p-0"
                      >
                        <Lock className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {secrets.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No secrets found. Add a new secret to get started.
        </div>
      )}
    </div>
  )
}