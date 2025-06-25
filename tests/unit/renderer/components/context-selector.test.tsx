import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextSelector } from '../../../../src/renderer/components/context-selector';
import type { ContextData } from '../../../../src/shared/types/context-data';

// Mock console methods to avoid noise in tests
const mockConsole = {
    log: vi.fn(),
    error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

// Mock window.alert
const mockAlert = vi.fn();
vi.stubGlobal('alert', mockAlert);

describe('ContextSelector', () => {
    const mockContextData: ContextData = {
        environment: 'dev',
        instance: 0,
        product: 'test-product',
        customer: 'test-customer',
        version: '1.0.0',
        baseHostUrl: 'https://test.example.com'
    };

    const mockOnContextChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Display Mode', () => {
        /**
         * Test that the component renders correctly in display mode
         */
        it('should render context data in display mode', () => {
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            expect(screen.getByText('Environment:')).toBeInTheDocument();
            expect(screen.getByText('dev')).toBeInTheDocument();
            expect(screen.getByText('Instance:')).toBeInTheDocument();
            expect(screen.getByText('Single')).toBeInTheDocument();
            expect(screen.getByText('Product:')).toBeInTheDocument();
            expect(screen.getByText('test-product')).toBeInTheDocument();
            expect(screen.getByText('Customer:')).toBeInTheDocument();
            expect(screen.getByText('test-customer')).toBeInTheDocument();
            expect(screen.getByText('Version:')).toBeInTheDocument();
            expect(screen.getByText('1.0.0')).toBeInTheDocument();
            expect(screen.getByText('Edit Context')).toBeInTheDocument();
        });

        /**
         * Test instance display for different values
         */
        it('should display correct instance labels and colors', () => {
            const testCases = [
                { instance: 0, label: 'Single', expectedClass: 'bg-blue-500' },
                { instance: 1, label: 'First', expectedClass: 'bg-green-500' },
                { instance: 2, label: 'Second', expectedClass: 'bg-amber-500' },
                { instance: 3, label: 'Third', expectedClass: 'bg-orange-500' },
                { instance: 4, label: 'Fourth', expectedClass: 'bg-red-500' },
            ];

            testCases.forEach(({ instance, label }) => {
                const contextWithInstance = { ...mockContextData, instance };
                const { rerender } = render(
                    <ContextSelector
                        context={contextWithInstance}
                        onContextChange={mockOnContextChange}
                    />
                );

                expect(screen.getByText(label)).toBeInTheDocument();

                rerender(
                    <ContextSelector
                        context={mockContextData}
                        onContextChange={mockOnContextChange}
                    />
                );
            });
        });

        /**
         * Test switching to edit mode
         */
        it('should switch to edit mode when Edit Context button is clicked', async () => {
            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            const editButton = screen.getByText('Edit Context');
            await user.click(editButton);

            // Should show form elements
            expect(screen.getByLabelText('Environment:')).toBeInTheDocument();
            expect(screen.getByLabelText('Instance:')).toBeInTheDocument();
            expect(screen.getByLabelText('Product:')).toBeInTheDocument();
            expect(screen.getByLabelText('Customer:')).toBeInTheDocument();
            expect(screen.getByLabelText('Version:')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText('Save')).toBeInTheDocument();
        });
    });

    describe('Edit Mode', () => {
        /**
         * Helper function to enter edit mode
         */
        const enterEditMode = async () => {
            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            const editButton = screen.getByText('Edit Context');
            await user.click(editButton);
            return user;
        };

        /**
         * Test form field updates
         */
        it('should update form fields when user types', async () => {
            const user = await enterEditMode();

            const productInput = screen.getByDisplayValue('test-product');
            await user.clear(productInput);
            await user.type(productInput, 'new-product');

            expect(productInput).toHaveValue('new-product');
        });

        /**
         * Test environment selection
         */
        it('should update environment when selected from dropdown', async () => {
            const user = await enterEditMode();

            const environmentSelect = screen.getByRole('combobox', { name: /environment/i });
            await user.click(environmentSelect);

            // Find and click the Production option
            const productionOption = await screen.findByRole('option', { name: /production/i });
            await user.click(productionOption);

            // Submit the form to trigger onContextChange
            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            expect(mockOnContextChange).toHaveBeenCalledWith(
                expect.objectContaining({ environment: 'prod' })
            );
        });

        /**
         * Test instance selection
         */
        it('should update instance when selected from dropdown', async () => {
            const user = await enterEditMode();

            const instanceSelect = screen.getByRole('combobox', { name: /instance/i });
            await user.click(instanceSelect);

            // Find and click the First option
            const firstOption = await screen.findByRole('option', { name: /first/i });
            await user.click(firstOption);

            // Submit the form to trigger onContextChange
            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            expect(mockOnContextChange).toHaveBeenCalledWith(
                expect.objectContaining({ instance: 1 })
            );
        });

        /**
         * Test form cancellation
         */
        it('should revert changes when Cancel is clicked', async () => {
            const user = await enterEditMode();

            // Make changes
            const productInput = screen.getByDisplayValue('test-product');
            await user.clear(productInput);
            await user.type(productInput, 'changed-product');

            // Cancel
            const cancelButton = screen.getByText('Cancel');
            await user.click(cancelButton);

            // Should be back in display mode with original values
            expect(screen.getByText('test-product')).toBeInTheDocument();
            expect(screen.getByText('Edit Context')).toBeInTheDocument();
        });

        /**
         * Test successful form submission
         */
        it('should call onContextChange with updated data when Save is clicked', async () => {
            const user = await enterEditMode();

            // Make changes
            const productInput = screen.getByDisplayValue('test-product');
            await user.clear(productInput);
            await user.type(productInput, 'updated-product');

            const customerInput = screen.getByDisplayValue('test-customer');
            await user.clear(customerInput);
            await user.type(customerInput, 'updated-customer');

            // Submit
            const saveButton = screen.getByText('Save');
            await user.click(saveButton);

            // Verify callback was called with updated data
            expect(mockOnContextChange).toHaveBeenCalledWith({
                ...mockContextData,
                product: 'updated-product',
                customer: 'updated-customer'
            });

            // Should be back in display mode
            expect(screen.getByText('Edit Context')).toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        /**
         * Test validation for missing required fields
         */
        it('should show alert for missing required fields', async () => {
            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            const editButton = screen.getByText('Edit Context');
            await user.click(editButton);

            // Clear required field
            const productInput = screen.getByDisplayValue('test-product');
            await user.clear(productInput);

            // Try to submit
            const saveButton = screen.getByText('Save');
            await user.click(saveButton);

            // Should show alert and not call onContextChange
            expect(mockAlert).toHaveBeenCalledWith('Please fill in required fields: product');
            expect(mockOnContextChange).not.toHaveBeenCalled();
        });

        /**
         * Test validation for invalid instance value
         */
        it('should validate instance as a valid number', async () => {
            const invalidContext = { ...mockContextData, instance: -1 };
            const user = userEvent.setup();

            render(
                <ContextSelector
                    context={invalidContext}
                    onContextChange={mockOnContextChange}
                />
            );

            const editButton = screen.getByText('Edit Context');
            await user.click(editButton);

            // Try to submit with invalid instance
            const saveButton = screen.getByText('Save');
            await user.click(saveButton);

            expect(mockAlert).toHaveBeenCalledWith('Instance must be a valid number');
            expect(mockOnContextChange).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        /**
         * Test error handling in onContextChange callback
         */
        it('should handle errors in onContextChange callback', async () => {
            const errorCallback = vi.fn().mockImplementation(() => {
                throw new Error('Context change failed');
            });

            const user = userEvent.setup();
            render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={errorCallback}
                />
            );

            const editButton = screen.getByText('Edit Context');
            await user.click(editButton);

            const saveButton = screen.getByText('Save');
            await user.click(saveButton);

            expect(mockAlert).toHaveBeenCalledWith('Failed to save context changes');
            expect(mockConsole.error).toHaveBeenCalledWith(
                '❌ Error in onContextChange callback:',
                expect.any(Error)
            );
        });
    });

    describe('Props Updates', () => {
        /**
         * Test component updates when context prop changes
         */
        it('should update display when context prop changes', () => {
            const { rerender } = render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            expect(screen.getByText('test-product')).toBeInTheDocument();

            const updatedContext = { ...mockContextData, product: 'updated-product' };
            rerender(
                <ContextSelector
                    context={updatedContext}
                    onContextChange={mockOnContextChange}
                />
            );

            expect(screen.getByText('updated-product')).toBeInTheDocument();
        });

        /**
         * Test that form data doesn't update when editing
         */
        it('should not update form data when editing and context prop changes', async () => {
            const user = userEvent.setup();
            const { rerender } = render(
                <ContextSelector
                    context={mockContextData}
                    onContextChange={mockOnContextChange}
                />
            );

            // Enter edit mode
            const editButton = screen.getByText('Edit Context');
            await user.click(editButton);

            // Verify initial form value
            expect(screen.getByLabelText(/product/i)).toHaveValue('test-product');

            // Update context prop while editing
            const updatedContext = { ...mockContextData, product: 'external-update' };
            rerender(
                <ContextSelector
                    context={updatedContext}
                    onContextChange={mockOnContextChange}
                />
            );

            // Form should still show original value
            expect(screen.getByLabelText(/product/i)).toHaveValue('test-product');
        });
    });
});