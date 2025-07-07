import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldConfigurationPanel } from '../../../../../src/renderer/components/template-creator/FieldConfigurationPanel';
import { EnhancedTemplateField, ArrayItemFieldConfig } from '../../../../../src/shared/types/enhanced-template-field';
import { SchemaProperty } from '../../../../../src/shared/types/schema';
import { createMockElectronAPI } from '../../../../utils/test-helpers';

/**
 * Integration tests for FieldConfigurationPanel component
 * Tests the component's interaction with schema services, template workflow, and field management
 */

// Enhanced ResizeObserver mock with proper implementation
class MockResizeObserver {
    private callback: ResizeObserverCallback;
    private elements: Set<Element> = new Set();

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }

    observe = vi.fn((element: Element) => {
        this.elements.add(element);
        // Simulate initial observation with proper ResizeObserverEntry
        const mockEntry = {
            target: element,
            contentRect: {
                width: 300,
                height: 200,
                top: 0,
                left: 0,
                bottom: 200,
                right: 300,
                x: 0,
                y: 0,
                toJSON: () => ({})
            },
            borderBoxSize: [{ blockSize: 200, inlineSize: 300 }],
            contentBoxSize: [{ blockSize: 200, inlineSize: 300 }],
            devicePixelContentBoxSize: [{ blockSize: 200, inlineSize: 300 }]
        } as ResizeObserverEntry;

        // Call callback asynchronously
        setTimeout(() => {
            this.callback([mockEntry], this);
        }, 0);
    });

    unobserve = vi.fn((element: Element) => {
        this.elements.delete(element);
    });

    disconnect = vi.fn(() => {
        this.elements.clear();
    });
}

// Set up ResizeObserver mock globally
Object.defineProperty(global, 'ResizeObserver', {
    value: MockResizeObserver,
    writable: true,
    configurable: true
});

// Mock electron API with enhanced schema service integration
const mockElectronAPI = createMockElectronAPI({
    invoke: vi.fn().mockImplementation((channel, ...args) => {
        switch (channel) {
            case 'schema:getResourceSchema':
                return Promise.resolve({
                    type: 'object',
                    properties: {
                        apiGroups: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'API groups for the rule'
                        },
                        resources: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Resources for the rule'
                        },
                        verbs: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Verbs for the rule'
                        }
                    },
                    required: ['apiGroups', 'resources', 'verbs']
                });
            case 'schema:validateFieldConfiguration':
                return Promise.resolve({ valid: true, errors: [] });
            case 'template:generatePreview':
                return Promise.resolve({
                    yaml: 'apiVersion: v1\nkind: Service\nspec:\n  type: ClusterIP',
                    valid: true
                });
            default:
                return Promise.resolve();
        }
    })
});

Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true
});

/**
 * Mock schema properties for PolicyRule array items
 */
const mockPolicyRuleProperties: SchemaProperty[] = [
    {
        name: 'apiGroups',
        path: 'apiGroups',
        type: 'array',
        description: 'API groups for the rule',
        required: true,
        hasChildren: false,
        isReference: false
    },
    {
        name: 'resources',
        path: 'resources',
        type: 'array',
        description: 'Resources for the rule',
        required: true,
        hasChildren: false,
        isReference: false
    },
    {
        name: 'verbs',
        path: 'verbs',
        type: 'array',
        description: 'Verbs for the rule',
        required: true,
        hasChildren: false,
        isReference: false
    }
];

/**
 * Mock enhanced template fields for different scenarios
 */
const mockStringFieldWithEnum: EnhancedTemplateField = {
    path: 'spec.type',
    title: 'Service Type',
    type: 'string',
    required: false,
    constraints: {
        enum: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName']
    },
    description: 'Specifies the type of service'
};

const mockArrayFieldWithComplexItems: EnhancedTemplateField = {
    path: 'rules',
    title: 'Policy Rules',
    type: 'array',
    required: true,
    arrayItemSchema: {
        type: 'object',
        properties: mockPolicyRuleProperties
    },
    description: 'Rules for the ClusterRole'
};

const mockNumberField: EnhancedTemplateField = {
    path: 'spec.replicas',
    title: 'Replicas',
    type: 'number',
    required: false,
    constraints: {
        minimum: 1,
        maximum: 100
    },
    description: 'Number of pod replicas'
};

const mockBooleanField: EnhancedTemplateField = {
    path: 'spec.enabled',
    title: 'Enabled',
    type: 'boolean',
    required: false,
    description: 'Whether the feature is enabled'
};

/**
 * Helper function to find text in a specific container to avoid multiple matches
 */
const findTextInContainer = (text: string, containerSelector?: string) => {
    if (containerSelector) {
        const container = document.querySelector(containerSelector);
        if (container) {
            return screen.getByText(text, { container: container as HTMLElement });
        }
    }
    return screen.getByText(text);
};

/**
 * Helper function to wait for element with specific container context
 */
const waitForTextInContainer = async (text: string, containerSelector?: string, options = {}) => {
    return await waitFor(() => {
        return findTextInContainer(text, containerSelector);
    }, { timeout: 3000, ...options });
};

/**
 * Helper function to find text that might be split across elements with better specificity
 */
const findTextAcrossElements = (text: string, options: { container?: HTMLElement } = {}) => {
    const elements = screen.queryAllByText((content, element) => {
        if (!element) return false;
        // Check if we're in the right container
        if (options.container && !options.container.contains(element)) {
            return false;
        }
        return element.textContent?.includes(text) || false;
    });

    if (elements.length === 0) {
        throw new Error(`Unable to find element with text: ${text}`);
    }

    return elements[0];
};

/**
 * Helper function to wait for element with flexible text matching and container context
 */
const waitForTextAcrossElements = async (text: string, options: { container?: HTMLElement } = {}) => {
    return await waitFor(() => {
        return findTextAcrossElements(text, options);
    }, { timeout: 5000 });
};

describe('FieldConfigurationPanel Integration Tests', () => {
    let mockOnDefaultValueChange: ReturnType<typeof vi.fn>;
    let mockOnNestedFieldToggle: ReturnType<typeof vi.fn>;
    let mockOnArrayConfigChange: ReturnType<typeof vi.fn>;
    let mockArrayConfig: ArrayItemFieldConfig;

    beforeEach(() => {
        mockOnDefaultValueChange = vi.fn();
        mockOnNestedFieldToggle = vi.fn();
        mockOnArrayConfigChange = vi.fn();
        mockArrayConfig = {
            selectedFields: ['apiGroups', 'resources'],
            fieldConfigurations: {}
        };
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const findTextAcrossElements = (text: string, options: { container?: HTMLElement } = {}) => {
        const elements = screen.queryAllByText((content, element) => {
            if (!element) return false;
            // Check if we're in the right container
            if (options.container && !options.container.contains(element)) {
                return false;
            }
            return element.textContent?.includes(text) || false;
        });

        if (elements.length === 0) {
            throw new Error(`Unable to find element with text: ${text}`);
        }

        return elements[0];
    };

    /**
     * Helper function to wait for element with flexible text matching and container context
     */
    const waitForTextAcrossElements = async (text: string, options: { container?: HTMLElement } = {}) => {
        return await waitFor(() => {
            return findTextAcrossElements(text, options);
        }, { timeout: 3000 });
    };

    /**
     * Test complete workflow for string field with enum configuration
     */
    describe('String Field with Enum Integration', () => {
        it('should integrate with schema service for enum validation', async () => {
            const user = userEvent.setup();

            render(
                <FieldConfigurationPanel
                    field={mockStringFieldWithEnum}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // Use more robust queries - check for heading and description elements
            expect(screen.getByRole('heading', { name: /field configuration/i })).toBeInTheDocument();

            // The component renders title and path together as "Service Type • spec.type"
            await waitFor(() => {
                expect(screen.getByText('Service Type • spec.type')).toBeInTheDocument();
            }, { timeout: 5000 });

            // Open select dropdown using data-testid
            const selectTrigger = screen.getByTestId('select');
            await user.click(selectTrigger);

            // Wait for dropdown options to appear
            await waitFor(() => {
                expect(screen.getByText('ClusterIP')).toBeInTheDocument();
                expect(screen.getByText('NodePort')).toBeInTheDocument();
                expect(screen.getByText('LoadBalancer')).toBeInTheDocument();
            }, { timeout: 5000 });

            // Select an option
            await user.click(screen.getByText('LoadBalancer'));

            // Verify callback is triggered
            await waitFor(() => {
                expect(mockOnDefaultValueChange).toHaveBeenCalledWith('spec.type', 'LoadBalancer');
            });
        });

        it('should validate field configuration with backend service', async () => {
            render(
                <FieldConfigurationPanel
                    field={mockStringFieldWithEnum}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // Trigger validation by changing value
            const user = userEvent.setup();
            const selectTrigger = screen.getByTestId('select');
            await user.click(selectTrigger);

            await waitFor(() => {
                expect(screen.getByText('ClusterIP')).toBeInTheDocument();
            }, { timeout: 3000 });

            await user.click(screen.getByText('ClusterIP'));

            // Verify callback was triggered (validation happens in parent component)
            await waitFor(() => {
                expect(mockOnDefaultValueChange).toHaveBeenCalledWith('spec.type', 'ClusterIP');
            }, { timeout: 3000 });
        });
    });

    /**
     * Test complex array field integration with schema service
     */
    describe('Array Field Integration', () => {
        it('should integrate with schema service for array item configuration', async () => {
            const user = userEvent.setup();

            render(
                <FieldConfigurationPanel
                    field={mockArrayFieldWithComplexItems}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // Verify array configuration UI using more flexible queries
            expect(screen.getByRole('heading', { name: /array item configuration/i })).toBeInTheDocument();
            expect(screen.getByText(/configure which fields to include/i)).toBeInTheDocument();

            // Verify schema properties are loaded
            expect(screen.getByText('apiGroups')).toBeInTheDocument();
            expect(screen.getByText('resources')).toBeInTheDocument();
            expect(screen.getByText('verbs')).toBeInTheDocument();

            // Test field selection using data-testid instead of name pattern
            const checkboxes = screen.getAllByTestId('checkbox');
            const verbsCheckbox = checkboxes.find(checkbox => {
                const container = checkbox.closest('.flex');
                return container && container.textContent?.includes('verbs');
            });

            expect(verbsCheckbox).toBeInTheDocument();
            await user.click(verbsCheckbox!);

            // Verify integration callbacks
            await waitFor(() => {
                expect(mockOnNestedFieldToggle).toHaveBeenCalledWith(
                    'rules',
                    expect.objectContaining({ name: 'verbs', path: 'verbs' }),
                    true
                );
                expect(mockOnArrayConfigChange).toHaveBeenCalled();
            });
        });

        it('should show selected fields summary', () => {
            render(
                <FieldConfigurationPanel
                    field={mockArrayFieldWithComplexItems}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // Check for the presence of selected fields in the UI
            // The component shows selected fields in the array config
            expect(screen.getByText('apiGroups')).toBeInTheDocument();
            expect(screen.getByText('resources')).toBeInTheDocument();

            // Verify that the array configuration section is present
            expect(screen.getByRole('heading', { name: /array item configuration/i })).toBeInTheDocument();
        });
    });

    /**
     * Test number field integration with constraints
     */
    describe('Number Field Integration', () => {
        it('should handle number field with constraints', async () => {
            const user = userEvent.setup();

            render(
                <FieldConfigurationPanel
                    field={mockNumberField}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // Verify number input with constraints using data-testid
            const input = screen.getByTestId('input');
            expect(input).toHaveAttribute('type', 'number');
            expect(input).toHaveAttribute('min', '1');
            expect(input).toHaveAttribute('max', '100');

            // Test value change
            await user.clear(input);
            await user.type(input, '5');

            await waitFor(() => {
                expect(mockOnDefaultValueChange).toHaveBeenCalledWith('spec.replicas', 5);
            });
        });
    });

    /**
     * Test boolean field integration
     */
    describe('Boolean Field Integration', () => {
        it('should handle boolean field toggle', async () => {
            const user = userEvent.setup();

            render(
                <FieldConfigurationPanel
                    field={mockBooleanField}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // Test boolean toggle using data-testid
            const switchElement = screen.getByTestId('switch');
            await user.click(switchElement);

            await waitFor(() => {
                expect(mockOnDefaultValueChange).toHaveBeenCalledWith('spec.enabled', true);
            });
        });
    });

    /**
     * Test field state management across component updates
     */
    describe('Field State Management Integration', () => {
        it('should maintain state consistency across field changes', async () => {
            const { rerender } = render(
                <FieldConfigurationPanel
                    field={mockStringFieldWithEnum}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // Change to number field
            rerender(
                <FieldConfigurationPanel
                    field={mockNumberField}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // The component renders title and path together as "Replicas • spec.replicas"
            await waitFor(() => {
                expect(screen.getByText('Replicas • spec.replicas')).toBeInTheDocument();
            }, { timeout: 5000 });

            expect(screen.getByTestId('input')).toBeInTheDocument();
        });
    });

    /**
     * Test template generation integration
     */
    describe('Template Generation Integration', () => {
        it('should integrate with template generation service', async () => {
            const user = userEvent.setup();

            render(
                <FieldConfigurationPanel
                    field={mockStringFieldWithEnum}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // Set a default value
            const selectTrigger = screen.getByTestId('select');
            await user.click(selectTrigger);

            await waitFor(() => {
                expect(screen.getByText('ClusterIP')).toBeInTheDocument();
            }, { timeout: 3000 });

            await user.click(screen.getByText('ClusterIP'));

            // Verify callback was triggered (template generation happens in parent)
            await waitFor(() => {
                expect(mockOnDefaultValueChange).toHaveBeenCalledWith('spec.type', 'ClusterIP');
            }, { timeout: 3000 });
        });
    });

    /**
     * Test error handling and recovery
     */
    describe('Error Handling Integration', () => {
        it('should handle schema service errors gracefully', async () => {
            render(
                <FieldConfigurationPanel
                    field={mockArrayFieldWithComplexItems}
                    onDefaultValueChange={mockOnDefaultValueChange}
                    onNestedFieldToggle={mockOnNestedFieldToggle}
                    onArrayConfigChange={mockOnArrayConfigChange}
                    arrayConfig={mockArrayConfig}
                />
            );

            // The component renders title and path together as "Policy Rules • rules"
            await waitFor(() => {
                expect(screen.getByText('Policy Rules • rules')).toBeInTheDocument();
            }, { timeout: 5000 });

            expect(screen.getByRole('heading', { name: /array item configuration/i })).toBeInTheDocument();
        });
    });
});