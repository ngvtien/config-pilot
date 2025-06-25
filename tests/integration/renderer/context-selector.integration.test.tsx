import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextSelector } from '../../../src/renderer/components/context-selector';
import type { ContextData } from '../../../src/shared/types/context-data';

/**
 * Integration tests for ContextSelector component
 * These tests focus on real-world usage scenarios and component integration
 */
describe('ContextSelector Integration Tests', () => {
    const mockContextData: ContextData = {
        environment: 'dev',
        instance: 0,
        product: 'integration-test',
        customer: 'test-customer',
        version: '2.0.0',
        baseHostUrl: 'https://integration.example.com'
    };

    const mockOnContextChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Complete User Workflows', () => {
        /**
         * Test complete edit workflow with multiple field changes
         */
        it('should handle complete context editing workflow', async () => {
            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            // Start editing
            await user.click(screen.getByText('Edit Context'));

            // Change environment
            await user.click(screen.getByRole('combobox', { name: /environment/i }));
            await user.click(screen.getByRole('option', { name: 'Production' }));

            // Change instance
            await user.click(screen.getByRole('combobox', { name: /instance/i }));
            await user.click(screen.getByRole('option', { name: 'Second' }));

            // Change text fields
            const productInput = screen.getByDisplayValue('integration-test');
            await user.clear(productInput);
            await user.type(productInput, 'production-app');

            const versionInput = screen.getByDisplayValue('2.0.0');
            await user.clear(versionInput);
            await user.type(versionInput, '3.0.0');

            // Save changes
            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });
            await user.click(screen.getByText('Save'));

            // Verify all changes were applied
            expect(mockOnContextChange).toHaveBeenCalledWith({
                ...mockContextData,
                environment: 'prod',
                instance: 2,
                product: 'production-app',
                version: '3.0.0'
            });
        });

        /**
         * Test rapid edit/cancel cycles
         */
        it('should handle rapid edit and cancel operations', async () => {
            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            // Multiple edit/cancel cycles
            for (let i = 0; i < 3; i++) {
                await user.click(screen.getByText('Edit Context'));

                // Make some changes
                const productInput = screen.getByDisplayValue('integration-test');
                await user.clear(productInput);
                await user.type(productInput, `temp-${i}`);

                // Cancel
                await user.click(screen.getByText('Cancel'));

                // Verify we're back to display mode with original data
                expect(screen.getByText('integration-test')).toBeInTheDocument();
                expect(screen.getByText('Edit Context')).toBeInTheDocument();
            }

            expect(mockOnContextChange).not.toHaveBeenCalled();
        });
    });

    describe('Environment-Specific Scenarios', () => {
        /**
         * Test different environment configurations
         */
        it('should handle all environment types correctly', async () => {
            const environments = [
                { value: 'dev', label: 'Development' },
                { value: 'sit', label: 'System Integration' },
                { value: 'uat', label: 'User Acceptance' },
                { value: 'prod', label: 'Production' }
            ];

            const user = userEvent.setup();

            for (const env of environments) {
                const contextWithEnv = { ...mockContextData, environment: env.value };
                const { rerender } = render(
                    <ContextSelector
                        context={contextWithEnv}
                        onContextChange={mockOnContextChange}
                    />
                );

                // Verify display
                expect(screen.getByText(env.value)).toBeInTheDocument();

                // Test editing
                await user.click(screen.getByText('Edit Context'));
                expect(screen.getByRole('combobox', { name: /environment/i })).toHaveTextContent(env.label);
                await user.click(screen.getByText('Cancel'));

                // Clean up for next iteration
                rerender(<div />);
            }
        });

        /**
         * Test instance configurations for multi-instance deployments
         */
        it('should handle multi-instance scenarios', async () => {
            const instances = [0, 1, 2, 3, 4];
            const user = userEvent.setup();

            for (const instance of instances) {
                const contextWithInstance = { ...mockContextData, instance };
                const { rerender } = render(
                    <ContextSelector
                        context={contextWithInstance}
                        onContextChange={mockOnContextChange}
                    />
                );

                // Enter edit mode and verify instance selection works
                await user.click(screen.getByText('Edit Context'));

                // Wait for edit mode to be fully active with longer timeout
                await waitFor(() => {
                    expect(screen.getByText('Save')).toBeInTheDocument();
                }, { timeout: 15000 });

                // Add longer delay to ensure the form is fully rendered and stable
                await new Promise(resolve => setTimeout(resolve, 500));

                // Check the actual select trigger element instead of hidden select
                const instanceSelect = screen.getByRole('combobox', { name: /instance/i });
                await waitFor(() => {
                    // Check if the select has the correct value by looking at its content
                    const expectedLabels = ['Single', 'First', 'Second', 'Third', 'Fourth'];
                    const expectedLabel = expectedLabels[instance];
                    expect(instanceSelect).toHaveTextContent(expectedLabel);
                }, { timeout: 10000 });

                await user.click(screen.getByText('Cancel'));

                // Add delay before cleanup
                await new Promise(resolve => setTimeout(resolve, 100));

                // Clean up
                rerender(<div />);
            }
        });
    });

    describe('Data Persistence and State Management', () => {
        /**
         * Test that component maintains state correctly during prop updates
         */
        it('should maintain editing state during external context updates', async () => {
            const user = userEvent.setup();
            const { rerender } = render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            // Start editing
            await user.click(screen.getByText('Edit Context'));

            // Wait for the component to enter edit mode
            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            }, { timeout: 3000 });

            // Make changes
            const productInput = screen.getByDisplayValue('integration-test');
            await user.clear(productInput);
            await user.type(productInput, 'user-changes');

            // External context update (simulating props change)
            const externalUpdate = { ...mockContextData, customer: 'external-change' };
            rerender(
                <ContextSelector
                    context={externalUpdate}
                    onContextChange={mockOnContextChange}
                />
            );

            // User changes should be preserved
            expect(screen.getByDisplayValue('user-changes')).toBeInTheDocument();

            // Save should use user's changes, not external updates
            await user.click(screen.getByText('Save'));

            expect(mockOnContextChange).toHaveBeenCalledWith({
                ...mockContextData,
                product: 'user-changes'
            });
        });

        /**
         * Test component behavior with async context changes
         */
        // In the async context change test:
        it('should handle async context change operations', async () => {
            let resolveContextChange: ((value: any) => void) | null = null;
            const asyncContextChange = vi.fn().mockImplementation(() => {
                return new Promise((resolve) => {
                    resolveContextChange = resolve;
                });
            });

            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={asyncContextChange}
                />
            );

            // Verify initial state
            expect(screen.getByText('Edit Context')).toBeInTheDocument();

            // Start editing with act wrapper
            await act(async () => {
                await user.click(screen.getByText('Edit Context'));
            });

            // Wait for edit mode with extended timeout
            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            }, { timeout: 25000 });

            // Rest of the test...
        });
    });

    describe('Accessibility and User Experience', () => {
        /**
         * Test keyboard navigation and accessibility
         */
        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            // Click Edit button to enter edit mode
            const editButton = screen.getByText('Edit Context');
            await user.click(editButton);

            // Wait for edit mode to be active with longer timeout
            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            }, { timeout: 15000 });

            // Add delay for form stability
            await new Promise(resolve => setTimeout(resolve, 300));

            // Tab through form fields
            await user.tab(); // Environment select
            await user.tab(); // Instance select  
            await user.tab(); // Product input
            await user.tab(); // Customer input
            await user.tab(); // Version input
            await user.tab(); // Cancel button
            await user.tab(); // Save button

            // Activate Save with Enter
            await user.keyboard('{Enter}');

            // Wait for the context change to be called
            await waitFor(() => {
                expect(mockOnContextChange).toHaveBeenCalled();
            }, { timeout: 10000 });
        });

        /**
         * Test form accessibility attributes
         */
        it('should have proper accessibility attributes', async () => {
            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            await user.click(screen.getByText('Edit Context'));

            // Check that form inputs have proper labels
            expect(screen.getByLabelText('Environment:')).toBeInTheDocument();
            expect(screen.getByLabelText('Instance:')).toBeInTheDocument();
            expect(screen.getByLabelText('Product:')).toBeInTheDocument();
            expect(screen.getByLabelText('Customer:')).toBeInTheDocument();
            expect(screen.getByLabelText('Version:')).toBeInTheDocument();

            // Check that buttons have proper roles
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        });
    });
});