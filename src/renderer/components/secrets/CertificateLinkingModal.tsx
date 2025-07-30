import React, { useState, useEffect } from "react"
import { Link, Search, Plus, X, Shield, Key, Lock, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Badge } from "@/renderer/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/renderer/components/ui/dialog"
import { Checkbox } from "@/renderer/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { CertificateMetadata, SecretItem } from "../types/secrets"
import { suggestRelatedSecretNames } from '../utils/certificate-utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/renderer/components/ui/select"

interface RelatedSecret {
    type: 'private-key' | 'password' | 'ca-bundle' | 'intermediate-cert'
    name: string
    vaultPath: string
    vaultKey: string
    exists: boolean
    suggested: boolean
}

interface CertificateLinkingModalProps {
    isOpen: boolean
    onClose: () => void
    certificateMetadata: CertificateMetadata
    certificateName: string
    certificateVaultPath: string
    existingSecrets: SecretItem[]
    customer: string
    env: string
    instance: number
    product: string
    onLinkSecrets: (linkedSecrets: RelatedSecret[]) => void
}

/**
 * Modal component for linking related secrets to certificates
 */
export const CertificateLinkingModal: React.FC<CertificateLinkingModalProps> = ({
    isOpen,
    onClose,
    certificateMetadata,
    certificateName,
    certificateVaultPath,
    existingSecrets,
    customer,
    env,
    instance,
    product,
    onLinkSecrets
}) => {
    const [relatedSecrets, setRelatedSecrets] = useState<RelatedSecret[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedSecrets, setSelectedSecrets] = useState<Set<string>>(new Set())

    /**
     * Generate smart suggestions for related secrets
     */
    useEffect(() => {
        if (!isOpen || !certificateMetadata) return

        const suggestions = suggestRelatedSecretNames(
            certificateName,
            certificateMetadata.fileName || ''
        )

        const basePath = certificateVaultPath
        const suggestedSecrets: RelatedSecret[] = []

        // Private key suggestion
        if (certificateMetadata.type === 'PEM' && !certificateMetadata.hasPrivateKey) {
            suggestedSecrets.push({
                type: 'private-key',
                name: suggestions.privateKey,
                vaultPath: basePath,
                vaultKey: suggestions.privateKey.toLowerCase().replace(/_/g, '-'),
                exists: existingSecrets.some(s => s.name === suggestions.privateKey),
                suggested: true
            })
        }

        // Password suggestion for encrypted certificates
        if (certificateMetadata.requiresPassword) {
            suggestedSecrets.push({
                type: 'password',
                name: suggestions.password,
                vaultPath: basePath,
                vaultKey: suggestions.password.toLowerCase().replace(/_/g, '-'),
                exists: existingSecrets.some(s => s.name === suggestions.password),
                suggested: true
            })
        }

        // CA bundle suggestion
        if (!certificateMetadata.isCA) {
            suggestedSecrets.push({
                type: 'ca-bundle',
                name: suggestions.caBundle,
                vaultPath: basePath,
                vaultKey: suggestions.caBundle.toLowerCase().replace(/_/g, '-'),
                exists: existingSecrets.some(s => s.name === suggestions.caBundle),
                suggested: true
            })
        }

        setRelatedSecrets(suggestedSecrets)
    }, [isOpen, certificateMetadata, certificateName, certificateVaultPath, existingSecrets])

    /**
     * Add a new custom secret link
     */
    const addCustomSecret = () => {
        const newSecret: RelatedSecret = {
            type: 'private-key',
            name: '',
            vaultPath: certificateVaultPath,
            vaultKey: '',
            exists: false,
            suggested: false
        }
        setRelatedSecrets([...relatedSecrets, newSecret])
    }

    /**
     * Update a related secret
     */
    const updateRelatedSecret = (index: number, updates: Partial<RelatedSecret>) => {
        const updated = [...relatedSecrets]
        updated[index] = { ...updated[index], ...updates }
        setRelatedSecrets(updated)
    }

    /**
     * Remove a related secret
     */
    const removeRelatedSecret = (index: number) => {
        const updated = relatedSecrets.filter((_, i) => i !== index)
        setRelatedSecrets(updated)
    }

    /**
     * Toggle secret selection
     */
    const toggleSecretSelection = (index: number) => {
        const secretKey = `${index}`
        const newSelected = new Set(selectedSecrets)
        if (newSelected.has(secretKey)) {
            newSelected.delete(secretKey)
        } else {
            newSelected.add(secretKey)
        }
        setSelectedSecrets(newSelected)
    }

    /**
     * Handle save and link secrets
     */
    const handleSave = () => {
        const secretsToLink = relatedSecrets.filter((_, index) =>
            selectedSecrets.has(`${index}`) && relatedSecrets[index].name.trim()
        )
        onLinkSecrets(secretsToLink)
        onClose()
    }

    /**
     * Get icon for secret type
     */
    const getSecretTypeIcon = (type: RelatedSecret['type']) => {
        switch (type) {
            case 'private-key': return <Key className="w-4 h-4" />
            case 'password': return <Lock className="w-4 h-4" />
            case 'ca-bundle': return <Shield className="w-4 h-4" />
            case 'intermediate-cert': return <FileText className="w-4 h-4" />
            default: return <FileText className="w-4 h-4" />
        }
    }

    /**
     * Get badge color for secret type
     */
    const getSecretTypeBadge = (type: RelatedSecret['type']) => {
        switch (type) {
            case 'private-key': return 'bg-blue-100 text-blue-800'
            case 'password': return 'bg-yellow-100 text-yellow-800'
            case 'ca-bundle': return 'bg-green-100 text-green-800'
            case 'intermediate-cert': return 'bg-purple-100 text-purple-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const filteredSecrets = relatedSecrets.filter(secret =>
        secret.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        secret.type.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link className="w-5 h-5" />
                        Link Related Secrets
                    </DialogTitle>
                    <DialogDescription>
                        Link related secrets like private keys, passwords, and CA bundles to this certificate for easy management.
                    </DialogDescription>
                </DialogHeader>

                {/* Certificate Info */}
                <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <h3 className="font-medium text-sm">Certificate: {certificateName}</h3>
                        <Badge variant="outline" className="text-xs">
                            {certificateMetadata.type} • {certificateMetadata.format}
                        </Badge>
                    </div>
                    <div className="text-xs text-gray-600">
                        <div>Path: {certificateVaultPath}</div>
                        {certificateMetadata.subject && <div>Subject: {certificateMetadata.subject}</div>}
                    </div>
                </div>

                {/* Search and Add */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search related secrets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button onClick={addCustomSecret} size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Custom
                    </Button>
                </div>

                {/* Related Secrets List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredSecrets.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No related secrets found. Add custom secrets to link them.</p>
                        </div>
                    ) : (
                        filteredSecrets.map((secret, index) => {
                            const originalIndex = relatedSecrets.findIndex(s => s === secret)
                            const isSelected = selectedSecrets.has(`${originalIndex}`)

                            return (
                                <div
                                    key={originalIndex}
                                    className={cn(
                                        "border rounded-lg p-4 transition-all",
                                        isSelected ? "border-blue-300 bg-blue-50" : "border-gray-200",
                                        secret.suggested && "border-green-300 bg-green-50"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSecretSelection(originalIndex)}
                                            className="mt-1"
                                        />

                                        <div className="flex-1 space-y-3">
                                            {/* Header */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {getSecretTypeIcon(secret.type)}
                                                    <Badge className={cn("text-xs", getSecretTypeBadge(secret.type))}>
                                                        {secret.type.replace('-', ' ').toUpperCase()}
                                                    </Badge>
                                                    {secret.suggested && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Suggested
                                                        </Badge>
                                                    )}
                                                    {secret.exists && (
                                                        <Badge variant="outline" className="text-xs text-green-600">
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            Exists
                                                        </Badge>
                                                    )}
                                                </div>

                                                {!secret.suggested && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeRelatedSecret(originalIndex)}
                                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Form Fields */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label htmlFor={`secret-type-${index}`}>Secret Type</Label>
                                                    <Select
                                                        value={secret.type}
                                                        onValueChange={(value) => updateRelatedSecret(index, { type: value as any })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="private-key">Private Key</SelectItem>
                                                            <SelectItem value="password">Password</SelectItem>
                                                            <SelectItem value="ca-bundle">CA Bundle</SelectItem>
                                                            <SelectItem value="intermediate-cert">Intermediate Certificate</SelectItem>
                                                            <SelectItem value="other">Other</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-xs">Secret Name</Label>
                                                    <Input
                                                        value={secret.name}
                                                        onChange={(e) => updateRelatedSecret(originalIndex, {
                                                            name: e.target.value.toUpperCase()
                                                        })}
                                                        placeholder="SECRET_NAME"
                                                        className="text-xs uppercase"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Vault Path</Label>
                                                    <Input
                                                        value={secret.vaultPath}
                                                        onChange={(e) => updateRelatedSecret(originalIndex, {
                                                            vaultPath: e.target.value
                                                        })}
                                                        placeholder="kv/customer/env/instance/product"
                                                        className="text-xs"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-xs">Vault Key</Label>
                                                    <Input
                                                        value={secret.vaultKey}
                                                        onChange={(e) => updateRelatedSecret(originalIndex, {
                                                            vaultKey: e.target.value.toLowerCase()
                                                        })}
                                                        placeholder="secret-key"
                                                        className="text-xs lowercase"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Summary */}
                {selectedSecrets.size > 0 && (
                    <div className="border-t pt-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>{selectedSecrets.size} secret(s) selected for linking</span>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={selectedSecrets.size === 0}
                    >
                        Link {selectedSecrets.size} Secret(s)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}