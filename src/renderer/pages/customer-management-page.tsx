"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Input } from '@/renderer/components/ui/input'
import { Label } from '@/renderer/components/ui/label'
import { Badge } from '@/renderer/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/renderer/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/renderer/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select'
import { Textarea } from '@/renderer/components/ui/textarea'
import { Switch } from '@/renderer/components/ui/switch'
import { Trash2, Edit, Plus, Download, Upload, Building2, Loader2, GitBranch, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import type { Customer, CustomerGitOpsConfig, CustomerGitOpsResult } from '@/shared/types/customer'
import { createNewCustomer, validateCustomer } from '@/shared/types/customer'
import { useDialog } from '@/renderer/hooks/useDialog'
import { GitRepositoryService } from '@/renderer/services/git-repository.service'
import { GitServerConfig } from '@/shared/types/git-repository'
import type { ContextData } from '@/shared/types/context-data'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'

interface CustomerManagementPageProps {
    onNavigateBack?: () => void
    context?: ContextData
}

/**
 * Customer management page for CRUD operations
 */
export function CustomerManagementPage({ onNavigateBack, context }: CustomerManagementPageProps) {
    const { showConfirm, showAlert, AlertDialog, ConfirmDialog } = useDialog()

    const [customers, setCustomers] = useState<Customer[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [formData, setFormData] = useState<Partial<Customer>>({})
    const [errors, setErrors] = useState<string[]>([])

    // const [gitServers, setGitServers] = useState<GitServerConfig[]>([])
    const [showGitOpsDialog, setShowGitOpsDialog] = useState(false)
    const [gitOpsConfig, setGitOpsConfig] = useState<CustomerGitOpsConfig>({
        createGitOpsRepo: false,
        serverId: '',
        gitBaseUrl: context?.baseHostUrl || '',  // Use context baseHostUrl
    })
    const [gitOpsLoading, setGitOpsLoading] = useState(false)

    const [repositoryValidationStatus, setRepositoryValidationStatus] = useState<Record<string, 'validating' | 'valid' | 'invalid' | 'unknown'>>({})



    // Add repository validation function
    const validateCustomerRepository = async (customer: Customer) => {
        if (!customer.metadata?.gitOps?.repositoryUrl) return

        setRepositoryValidationStatus(prev => ({
            ...prev,
            [customer.id]: 'validating'
        }))

        try {
            const isValid = await GitRepositoryService.testConnection(customer.metadata.gitOps.repositoryUrl)
            setRepositoryValidationStatus(prev => ({
                ...prev,
                [customer.id]: isValid ? 'valid' : 'invalid'
            }))
        } catch (error) {
            setRepositoryValidationStatus(prev => ({
                ...prev,
                [customer.id]: 'invalid'
            }))
        }
    }

    // Add validation for all customers
    const validateAllCustomerRepositories = async () => {
        const customersWithRepos = customers.filter(c => c.metadata?.gitOps?.repositoryUrl)
        await Promise.all(customersWithRepos.map(validateCustomerRepository))
    }

    // Add useEffect to validate repositories when customers load
    useEffect(() => {
        if (customers.length > 0) {
            const timer = setTimeout(() => {
                validateAllCustomerRepositories()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [customers])

    // // Load Git servers on component mount
    // useEffect(() => {
    //     loadGitServers()
    // }, [])

    // Load customers on component mount
    useEffect(() => {
        loadCustomers()
    }, [])

    /**
     * Load all customers from the service
     */
    const loadCustomers = async () => {
        setIsLoading(true)
        try {
            const response = await window.electronAPI?.customer?.getAllCustomers()
            if (response?.customers) {
                console.log('Loaded customers:', response.customers.map(c => ({
                    id: c.id,
                    name: c.name,
                    hasGitOps: !!c.metadata?.gitOps?.repositoryUrl,
                    repositoryUrl: c.metadata?.gitOps?.repositoryUrl
                })))
                setCustomers(response.customers)
            }
        } catch (error) {
            console.error('Failed to load customers:', error)
        } finally {
            setIsLoading(false)
        }
    }
    // /**
    //  * Load available Git servers
    //  */
    // const loadGitServers = async () => {
    //     try {
    //         const servers = await window.electronAPI?.customer?.getAvailableGitServers()
    //         setGitServers(servers || [])
    //     } catch (error: any) {
    //         console.error('Failed to load Git servers:', error)
    //     }
    // }

    /**
     * Handle saving customer with GitOps setup
     */
    const handleSaveCustomerWithGitOps = async () => {
        console.log(`💾 Starting customer save with GitOps...`)

        const validation = validateCustomer(formData)
        if (!validation.isValid) {
            console.warn(`❌ Customer validation failed:`, validation.errors)
            setErrors(validation.errors)
            return
        }

        setGitOpsLoading(true)
        try {
            let result
            if (editingCustomer) {
                // Update existing customer
                result = await window.electronAPI?.customer?.updateCustomer(editingCustomer.id, formData)

                // Setup GitOps if requested
                if (gitOpsConfig.createGitOpsRepo && gitOpsConfig.serverId) {
                    await window.electronAPI?.customer?.setupGitOps(editingCustomer.id, gitOpsConfig)
                }
            } else {
                // Create new customer with GitOps
                if (gitOpsConfig.createGitOpsRepo && gitOpsConfig.serverId) {
                    result = await window.electronAPI?.customer?.createCustomerWithGitOps(formData, gitOpsConfig)
                } else {
                    result = await window.electronAPI?.customer?.createCustomer(formData)
                }
            }

            console.log(`✅ Customer ${editingCustomer ? 'updated' : 'created'} successfully:`, result)

            await loadCustomers()
            setIsDialogOpen(false)
            setShowGitOpsDialog(false)
            setFormData({})
            setErrors([])

            // Show success message with GitOps info if applicable
            if (result?.gitOpsRepo) {
                await showAlert(
                    'Customer Created with GitOps',
                    `Customer "${result.customer.displayName || result.customer.name}" has been created successfully.\n\nGitOps Repository: ${result.gitOpsRepo.repository?.url}\nEnvironment Branches: ${result.gitOpsRepo.branches?.join(', ')}`
                )
            }
        } catch (error: any) {
            console.error(`❌ Failed to save customer:`, error)
            setErrors([error.message || 'Failed to save customer'])
        } finally {
            setGitOpsLoading(false)
        }
    }

    /**
     * Generate server ID from baseUrl using the same logic as GitService
     */
    const generateServerId = (baseUrl: string): string => {
        return baseUrl.replace(/[^a-zA-Z0-9]/g, '-');
    };

    /**
     * Handle GitOps setup for existing customer
     */
    const handleSetupGitOps = async (customer: Customer) => {
        setEditingCustomer(customer)
        setGitOpsConfig({
            serverId: context?.baseHostUrl ? generateServerId(context.baseHostUrl) : '', // Generate proper serverId from baseHostUrl
            gitBaseUrl: context?.baseHostUrl || '',
            createGitOpsRepo: true
        })
        setShowGitOpsDialog(true)
    }
    /**
     * Handle creating a new customer
     */
    const handleCreateCustomer = () => {
        setEditingCustomer(null)
        setFormData({
            name: '',
            displayName: '',
            description: '',
            isActive: true,
            metadata: {
                tier: 'basic'
            }
        })
        setErrors([])
        setIsDialogOpen(true)
    }

    /**
     * Handle editing an existing customer
     */
    const handleEditCustomer = (customer: Customer) => {
        setEditingCustomer(customer)
        setFormData({ ...customer })
        setErrors([])
        setIsDialogOpen(true)
    }

    /**
     * Smart GitOps setup function - follows product management pattern
     * Uses GitRepositoryService.createRepository directly like handleAddNewRepository
     */
    /**
     * Smart GitOps setup function - uses proper backend service
     */
    const setupCustomerGitOps = async (customerName: string): Promise<boolean> => {
        console.log(`🚀 Starting GitOps setup for customer: ${customerName}`);

        try {
            // Find the customer by name to get the ID
            const allCustomers = await window.electronAPI?.customer?.getAllCustomers();
            const customer = allCustomers?.customers?.find((c: Customer) => c.name === customerName);
            
            if (!customer) {
                throw new Error(`Customer '${customerName}' not found`);
            }

            // Use the proper backend service that handles organization creation and environment branches
            const gitServerConfig = {
                serverId: context?.baseHostUrl || '',
                gitBaseUrl: context?.baseHostUrl || ''
            };

            console.log(`🏗️ Setting up GitOps with config:`, gitServerConfig);
            const result = await window.electronAPI?.customer?.setupGitOps(customer.id, gitServerConfig);
            console.log(`✅ GitOps setup completed:`, result);

            return true;

        } catch (error: any) {
            console.error(`❌ GitOps setup failed for customer: ${customerName}`, error);
            throw new Error(`GitOps setup failed: ${error.message}`);
        }
    };
    /**
     * Handle saving customer (create or update)
     */
    const handleSaveCustomer = async () => {
        console.log(`💾 Starting customer save process...`);

        const validation = validateCustomer(formData)
        if (!validation.isValid) {
            console.warn(`❌ Customer validation failed:`, validation.errors);
            setErrors(validation.errors)
            return
        }

        console.log(`✅ Customer validation passed`);

        try {
            if (editingCustomer) {
                console.log(`📝 Updating existing customer:`, editingCustomer.id);
                await window.electronAPI?.customer?.updateCustomer(editingCustomer.id, formData)
                console.log(`✅ Customer updated successfully`);
            } else {
                console.log(`➕ Creating new customer:`, formData.name);
                await window.electronAPI?.customer?.createCustomer(formData as Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>)
                console.log(`✅ Customer created successfully`);
            }

            // Setup GitOps for ANY customer (new or existing) - follows product pattern
            console.log(`🔧 Starting GitOps setup...`);
            const gitOpsResult = await setupCustomerGitOps(formData.name);
            console.log(`🔧 GitOps setup result: ${gitOpsResult}`);

            setIsDialogOpen(false)
            await loadCustomers()
            console.log(`🎉 Customer save process completed successfully`);
        } catch (error: any) {
            console.error(`❌ Customer save failed:`, error);
            console.error(`❌ Error details:`, {
                message: error?.message,
                stack: error?.stack,
                name: error?.name
            });
            setErrors([error.message || 'Failed to save customer'])
        }
    }

    /**
     * Handle deleting a customer
     */
    const handleDeleteCustomer = async (customer: Customer) =>
        showConfirm({
            title: 'Delete Customer',
            message: `Are you sure you want to delete customer "${customer.displayName || customer.name}"?`,
            variant: 'destructive',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await window.electronAPI?.customer?.deleteCustomer(customer.id)
                    await loadCustomers()
                } catch (error: any) {
                    showAlert({
                        title: 'Error',
                        message: `Failed to delete customer: ${error.message}`,
                        variant: 'error'
                    })
                }
            }
        });


    /**
     * Handle exporting customers
     */
    const handleExportCustomers = async () => {
        try {
            const filePath = await window.electronAPI?.customer?.showSaveDialog()
            if (filePath) {
                await window.electronAPI?.customer?.exportCustomers(filePath)
                showAlert({
                    title: 'Success',
                    message: 'Customers exported successfully!',
                    variant: 'success'
                })
            }
        } catch (error: any) {
            showAlert({
                title: 'Error',
                message: `Failed to export customers: ${error.message}`,
                variant: 'error'
            })
        }
    }

    /**
     * Handle importing customers
     */
    const handleImportCustomers = async () => {
        try {
            const filePath = await window.electronAPI?.customer?.showOpenDialog()
            if (filePath) {
                await window.electronAPI?.customer?.importCustomers(filePath, 'merge')
                await loadCustomers()
                showAlert({
                    title: 'Success',
                    message: 'Customers imported successfully!',
                    variant: 'success'
                })
            }
        } catch (error: any) {
            showAlert({
                title: 'Error',
                message: `Failed to import customers: ${error.message}`,
                variant: 'error'
            })
        }
    }

    /**
     * Get tier badge color
     */
    const getTierBadgeColor = (tier?: string) => {
        switch (tier) {
            case 'enterprise': return 'bg-purple-100 text-purple-800'
            case 'premium': return 'bg-yellow-100 text-yellow-800'
            case 'basic': return 'bg-gray-100 text-gray-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const handleConfirmGitOpsSetup = async () => {
        if (!editingCustomer) return;

        setGitOpsLoading(true);
        try {
            // ✅ Use the working setupCustomerGitOps function instead
            const success = await setupCustomerGitOps(editingCustomer.name);

            if (success) {
                await loadCustomers();
                setShowGitOpsDialog(false);

                showAlert({
                    title: 'GitOps Setup Complete',
                    message: `✅ GitOps repository created successfully for ${editingCustomer.displayName || editingCustomer.name}`,
                    variant: 'success'
                });
            }
        } catch (error: any) {
            showAlert({
                title: 'GitOps Setup Failed',
                message: error.message,
                variant: 'error'
            });
        } finally {
            setGitOpsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading customers...</p>
                </div>
            </div>
        )
    }

    /**
     * Smart URL builder that handles trailing/leading slashes properly
     */
    const buildRepositoryUrl = (baseUrl: string, customerName: string): string => {
        if (!baseUrl || !customerName) return '[incomplete-url]';

        // Remove trailing slash from baseUrl and leading slash from path
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const cleanCustomerName = customerName.replace(/^\//, '');

        return `${cleanBaseUrl}/${cleanCustomerName}/gitops.git`;
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold">Customer Management</h1>
                        <p className="text-gray-600">Manage your customers and their configurations</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleImportCustomers}>
                        <Download className="h-4 w-4 mr-2" />
                        Import
                    </Button>
                    <Button variant="outline" onClick={handleExportCustomers}>
                        <Upload className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button onClick={handleCreateCustomer}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Customer
                    </Button>
                </div>
            </div>

            {/* Customer List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <TooltipProvider>
                    {customers.map((customer) => (
                        <Card key={customer.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">{customer.displayName || customer.name}</CardTitle>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditCustomer(customer)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        {customer.metadata?.gitOps?.repositoryUrl ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleSetupGitOps(customer)}
                                                        title="Reconfigure GitOps Repository"
                                                    >
                                                        ⚙️
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Reconfigure GitOps repository for this customer</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleSetupGitOps(customer)}
                                                        title="Setup GitOps Repository"
                                                    >
                                                        🔧
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Setup GitOps repository for this customer `{customer.name}` `{customer.metadata?.gitOps?.repositoryUrl}`</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteCustomer(customer)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <CardDescription className="text-sm">{customer.description || 'No description'}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Customer Details */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-600 dark:text-gray-400">Internal Name:</span>
                                        <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{customer.name}</code>
                                    </div>

                                    {customer.metadata?.tier && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-600 dark:text-gray-400">Tier:</span>
                                            <Badge className={getTierBadgeColor(customer.metadata.tier)}>
                                                {customer.metadata.tier}
                                            </Badge>
                                        </div>
                                    )}

                                    {customer.metadata?.region && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-600 dark:text-gray-400">Region:</span>
                                            <span>{customer.metadata.region}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Status Badges */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant={customer.isActive ? "default" : "secondary"}>
                                        {customer.isActive ? 'Active' : 'Inactive'}
                                    </Badge>

                                    {customer.metadata?.gitOps?.repositoryUrl ? (
                                        <Badge variant="outline" className="text-green-600 border-green-200">
                                            <GitBranch className="h-3 w-3 mr-1" />
                                            GitOps ✓
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-gray-500">
                                            No GitOps
                                        </Badge>
                                    )}
                                </div>

                                {/* Enhanced GitOps Repository Information */}
                                {customer.metadata?.gitOps?.repositoryUrl && (
                                    <div className="border-t pt-3 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-600 dark:text-gray-400">GitOps Repository:</span>
                                            <div className="flex items-center gap-1">
                                                {/* Repository validation status indicator */}
                                                {repositoryValidationStatus[customer.id] === 'validating' && (
                                                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                                )}
                                                {repositoryValidationStatus[customer.id] === 'valid' && (
                                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                                )}
                                                {repositoryValidationStatus[customer.id] === 'invalid' && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <XCircle className="h-3 w-3 text-red-500 cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Repository is not accessible or doesn't exist</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a
                                                            href={customer.metadata.gitOps.repositoryUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`flex items-center gap-1 truncate max-w-32 ${repositoryValidationStatus[customer.id] === 'invalid'
                                                                ? 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
                                                                : 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
                                                                }`}
                                                        >
                                                            <GitBranch className="h-3 w-3" />
                                                            <span>{customer.metadata.gitOps.repositoryUrl.split('/').pop()?.replace('.git', '')}</span>
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <div className="space-y-1">
                                                            <p className="font-medium">{repositoryValidationStatus[customer.id] === 'invalid'
                                                                ? 'Repository not accessible - click to attempt opening anyway'
                                                                : 'Open GitOps repository in new tab'}</p>
                                                            <p className="text-xs opacity-75">{customer.metadata.gitOps.repositoryUrl}</p>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>

                                        {customer.metadata.gitOps.environments && customer.metadata.gitOps.environments.length > 0 && (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-gray-600 dark:text-gray-400">Environments:</span>
                                                <div className="flex gap-1 flex-wrap">
                                                    {customer.metadata.gitOps.environments.map((env) => (
                                                        <Badge key={env} variant="secondary" className="text-xs px-1 py-0">
                                                            {env}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {repositoryValidationStatus[customer.id] === 'invalid' && (
                                            <div className="flex gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => validateCustomerRepository(customer)}
                                                            className="h-6 px-2 text-xs"
                                                        >
                                                            🔄 Retry
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Retry repository validation</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleSetupGitOps(customer)}
                                                            className="h-6 px-2 text-xs"
                                                        >
                                                            🔧 Reconfigure
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Reconfigure GitOps repository</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Last Updated */}
                                <div className="text-xs text-gray-500 pt-2 border-t">
                                    Updated: {new Date(customer.updatedAt).toLocaleDateString()}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TooltipProvider>
            </div>

            {customers.length === 0 && (
                <Card className="text-center py-12">
                    <CardContent>
                        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                        <p className="text-gray-600 mb-4">Get started by creating your first customer.</p>
                        <Button onClick={handleCreateCustomer}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Customer
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Customer Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCustomer ? 'Edit Customer' : 'Create New Customer'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCustomer
                                ? 'Update customer information and optionally setup GitOps repository.'
                                : 'Add a new customer to the system with optional GitOps repository setup.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                <ul className="text-sm text-red-600 space-y-1">
                                    {errors.map((error, index) => (
                                        <li key={index}>• {error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="displayName">Display Name *</Label>
                                <Input
                                    id="displayName"
                                    value={formData.displayName || ''}
                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                    placeholder="e.g., ACME Corporation"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Internal Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                                    placeholder="e.g., acme-corp"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description of the customer"
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tier">Tier</Label>
                                <Select
                                    value={formData.metadata?.tier || 'basic'}
                                    onValueChange={(value) => setFormData({
                                        ...formData,
                                        metadata: { ...formData.metadata, tier: value as any }
                                    })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="basic">Basic</SelectItem>
                                        <SelectItem value="premium">Premium</SelectItem>
                                        <SelectItem value="enterprise">Enterprise</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="region">Region</Label>
                                <Input
                                    id="region"
                                    value={formData.metadata?.region || ''}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        metadata: { ...formData.metadata, region: e.target.value }
                                    })}
                                    placeholder="e.g., us-east-1"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactEmail">Contact Email</Label>
                            <Input
                                id="contactEmail"
                                type="email"
                                value={formData.metadata?.contactEmail || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    metadata: { ...formData.metadata, contactEmail: e.target.value }
                                })}
                                placeholder="contact@customer.com"
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="isActive"
                                checked={formData.isActive ?? true}
                                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                            <Label htmlFor="isActive">Active Customer</Label>
                        </div>

                        {/* GitOps Setup Section */}
                        <div className="border-t pt-4">
                            <div className="flex items-center space-x-2 mb-4">
                                <Switch
                                    id="enableGitOps"
                                    checked={gitOpsConfig.createGitOpsRepo}
                                    onCheckedChange={(checked) =>
                                        setGitOpsConfig({ ...gitOpsConfig, createGitOpsRepo: checked })
                                    }
                                />
                                <Label htmlFor="enableGitOps" className="font-medium">
                                    Setup GitOps Repository
                                </Label>
                            </div>

                            {/* {gitOpsConfig.createGitOpsRepo && (
                                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                                    <div className="space-y-2">
                                        <Label htmlFor="gitServer">Git Server *</Label>
                                        <Select
                                            value={gitOpsConfig.serverId}
                                            onValueChange={(value) => {
                                                const server = gitServers.find(s => s.id === value)
                                                setGitOpsConfig({
                                                    ...gitOpsConfig,
                                                    serverId: value,
                                                    gitBaseUrl: server?.baseUrl || ''
                                                })
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Git server" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {gitServers.map((server) => (
                                                    <SelectItem key={server.id} value={server.id}>
                                                        {server.name} ({server.baseUrl})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                                        <p><strong>Repository URL:</strong> {gitOpsConfig.gitBaseUrl}/{formData.name || '[customer-name]'}/gitops.git</p>
                                        <p><strong>Environment Branches:</strong> dev, sit, uat, prod</p>
                                        <p><strong>Initial Content:</strong> README.md in each branch</p>
                                    </div>
                                </div>
                            )} */}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={gitOpsConfig.createGitOpsRepo ? handleSaveCustomerWithGitOps : handleSaveCustomer}
                            disabled={gitOpsLoading}
                        >
                            {gitOpsLoading ? 'Creating...' : (editingCustomer ? 'Update' : 'Create')} Customer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* GitOps Setup Dialog for Existing Customers */}
            <Dialog open={showGitOpsDialog} onOpenChange={setShowGitOpsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Setup GitOps Repository</DialogTitle>
                        <DialogDescription>
                            Configure GitOps repository for {editingCustomer?.displayName || editingCustomer?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="createGitOpsRepo"
                                checked={gitOpsConfig.createGitOpsRepo}
                                onCheckedChange={(checked) => setGitOpsConfig({
                                    ...gitOpsConfig,
                                    createGitOpsRepo: checked,
                                    gitBaseUrl: context?.baseHostUrl || ''
                                })}
                            />
                            <Label htmlFor="createGitOpsRepo">Setup GitOps Repository</Label>
                        </div>

                        {gitOpsConfig.createGitOpsRepo && (
                            <div className="space-y-2">
                                <Label>Git Server (from Settings)</Label>
                                <div className="p-2 bg-gray-50 dark:bg-gray-800 border rounded text-sm text-gray-900 dark:text-gray-100">
                                    {context?.baseHostUrl || 'No Git server configured in Settings'}
                                </div>
                                {context?.baseHostUrl && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        <strong>Repository URL:</strong> {buildRepositoryUrl(
                                            context.baseHostUrl,
                                            editingCustomer?.name || formData.name || 'customer-name'
                                        )}
                                    </p>
                                )}
                                {!context?.baseHostUrl && (
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        Please configure a Git server in Settings first.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowGitOpsDialog(false)}>
                            Cancel
                        </Button>

                        <Button onClick={handleConfirmGitOpsSetup}>
                            Setup GitOps
                        </Button>

                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog />
            <ConfirmDialog />
        </div>
    )
}