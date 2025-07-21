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
import { Trash2, Edit, Plus, Download, Upload, Building2 } from 'lucide-react'
import type { Customer } from '@/shared/types/customer'
import { createNewCustomer, validateCustomer } from '@/shared/types/customer'
import { useDialog } from '@/renderer/hooks/useDialog'

interface CustomerManagementPageProps {
    onNavigateBack?: () => void
}

/**
 * Customer management page for CRUD operations
 */
export function CustomerManagementPage({ onNavigateBack }: CustomerManagementPageProps) {
    const { showConfirm, showAlert, AlertDialog, ConfirmDialog } = useDialog()

    const [customers, setCustomers] = useState<Customer[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [formData, setFormData] = useState<Partial<Customer>>({})
    const [errors, setErrors] = useState<string[]>([])

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
                setCustomers(response.customers)
            }
        } catch (error) {
            console.error('Failed to load customers:', error)
        } finally {
            setIsLoading(false)
        }
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
     * Handle saving customer (create or update)
     */
    const handleSaveCustomer = async () => {
        const validation = validateCustomer(formData)
        if (!validation.isValid) {
            setErrors(validation.errors)
            return
        }

        try {
            if (editingCustomer) {
                // Update existing customer
                await window.electronAPI?.customer?.updateCustomer(editingCustomer.id, formData)
            } else {
                // Create new customer
                await window.electronAPI?.customer?.createCustomer(formData as Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>)
            }

            setIsDialogOpen(false)
            await loadCustomers()
        } catch (error: any) {
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
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteCustomer(customer)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <CardDescription>{customer.description || 'No description'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-300">Name:</span>
                                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs text-gray-900 dark:text-gray-100">{customer.name}</code>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-300">Tier:</span>
                                <Badge className={getTierBadgeColor(customer.metadata?.tier)}>
                                    {customer.metadata?.tier || 'basic'}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-300">Status:</span>
                                <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                                    {customer.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                            </div>
                            {customer.metadata?.region && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-300">Region:</span>
                                    <span>{customer.metadata.region}</span>
                                </div>
                            )}
                            <div className="text-xs text-gray-500">
                                Updated: {new Date(customer.updatedAt).toLocaleDateString()}
                            </div>
                        </CardContent>
                    </Card>
                ))}
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
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCustomer
                                ? 'Update the customer information below.'
                                : 'Create a new customer by filling out the form below.'}
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
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveCustomer}>
                            {editingCustomer ? 'Update' : 'Create'} Customer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog />
            <ConfirmDialog />
        </div>
    )
}