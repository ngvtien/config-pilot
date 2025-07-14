import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedPropertyEditor } from '@/renderer/components/enhanced-property-editor';
import { SchemaProperty } from '@/shared/types/schema';

/**
 * Test suite for EnhancedPropertyEditor component
 * Covers all property types, default value handling, and user interactions
 */
describe('EnhancedPropertyEditor', () => {
  const mockOnStateChange = vi.fn();

  const defaultProperty: SchemaProperty = {
    name: 'testProperty',
    path: 'test.property',
    type: 'string',
    title: 'Test Property',
    description: 'A test property',
    required: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test basic component rendering
   */
  describe('Basic Rendering', () => {
    it('should render with default string property', () => {
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      expect(screen.getByText('Enhanced Property Editor')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Property')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A test property')).toBeInTheDocument();
    });

    it('should render with minimal props', () => {
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      expect(screen.getByText('Enhanced Property Editor')).toBeInTheDocument();
    });
  });

  /**
   * Test property type changes
   */
  describe('Property Type Changes', () => {
    it('should handle string type selection', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const typeSelect = screen.getByRole('combobox', { name: /type/i });
      await user.click(typeSelect);
      await user.click(screen.getByText('String'));

      expect(screen.getByPlaceholderText('Enter default value')).toBeInTheDocument();
    });

    it('should handle number type selection', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const typeSelect = screen.getByRole('combobox', { name: /type/i });
      await user.click(typeSelect);
      await user.click(screen.getByText('Number'));

      expect(screen.getByDisplayValue('0')).toBeInTheDocument();
    });

    it('should handle boolean type selection', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const typeSelect = screen.getByRole('combobox', { name: /type/i });
      await user.click(typeSelect);
      await user.click(screen.getByText('Boolean'));

      expect(screen.getByText('False')).toBeInTheDocument();
    });

    it('should handle array type selection', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const typeSelect = screen.getByRole('combobox', { name: /type/i });
      await user.click(typeSelect);
      await user.click(screen.getByText('Array'));

      expect(screen.getByText('Array Items')).toBeInTheDocument();
      expect(screen.getByText('Item Type')).toBeInTheDocument();
    });
  });

  /**
   * Test enum functionality for string types
   */
  describe('Enum Functionality', () => {
    it('should add enum options', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const enumInput = screen.getByPlaceholderText('Add enum option');
      await user.type(enumInput, 'option1');
      await user.click(screen.getByRole('button', { name: /\+/ }));

      expect(screen.getByText('option1')).toBeInTheDocument();
    });

    it('should remove enum options', async () => {
      const user = userEvent.setup();
      const propertyWithEnum = {
        ...defaultProperty,
        enum: ['option1', 'option2']
      };

      render(
        <EnhancedPropertyEditor
          property={propertyWithEnum}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const removeButtons = screen.getAllByRole('button');
      const removeButton = removeButtons.find(btn => 
        btn.querySelector('svg') && btn.closest('.flex.items-center.gap-1')
      );
      
      if (removeButton) {
        await user.click(removeButton);
      }

      await waitFor(() => {
        expect(screen.queryByText('option1')).not.toBeInTheDocument();
      });
    });

    it('should not add duplicate enum options', async () => {
      const user = userEvent.setup();
      const propertyWithEnum = {
        ...defaultProperty,
        enum: ['option1']
      };

      render(
        <EnhancedPropertyEditor
          property={propertyWithEnum}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const enumInput = screen.getByPlaceholderText('Add enum option');
      await user.type(enumInput, 'option1');
      await user.click(screen.getByRole('button', { name: /\+/ }));

      const option1Elements = screen.getAllByText('option1');
      expect(option1Elements).toHaveLength(1);
    });
  });

  /**
   * Test array functionality
   */
  describe('Array Functionality', () => {
    const arrayProperty: SchemaProperty = {
      ...defaultProperty,
      type: 'array',
      items: { type: 'string' },
      default: ['item1', 'item2']
    };

    it('should render existing array items', () => {
      render(
        <EnhancedPropertyEditor
          property={arrayProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      expect(screen.getByDisplayValue('item1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('item2')).toBeInTheDocument();
    });

    it('should add new array items', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={arrayProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      await user.click(screen.getByText('Add Item'));
      
      const inputs = screen.getAllByPlaceholderText('Enter string value');
      expect(inputs).toHaveLength(3); // 2 existing + 1 new
    });

    it('should remove array items', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={arrayProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn => 
        btn.querySelector('svg') && btn.closest('.flex.items-center.space-x-2')
      );
      
      if (trashButton) {
        await user.click(trashButton);
      }

      await waitFor(() => {
        expect(screen.queryByDisplayValue('item1')).not.toBeInTheDocument();
      });
    });

    it('should handle different array item types', async () => {
      const user = userEvent.setup();
      const numberArrayProperty = {
        ...arrayProperty,
        items: { type: 'number' },
        default: [1, 2]
      };

      render(
        <EnhancedPropertyEditor
          property={numberArrayProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    });
  });

  /**
   * Test state change functionality
   */
  describe('State Change Functionality', () => {
    it('should call onStateChange when title is updated', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const titleInput = screen.getByDisplayValue('Test Property');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      // Wait for the debounced state change
      await waitFor(() => {
        expect(mockOnStateChange).toHaveBeenCalledWith(
          'test.property',
          expect.objectContaining({
            title: 'Updated Title'
          })
        );
      });
    });

    it('should include enum options in state change', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const enumInput = screen.getByPlaceholderText('Add enum option');
      await user.type(enumInput, 'option1');
      await user.click(screen.getByRole('button', { name: /\+/ }));

      // Wait for the debounced state change
      await waitFor(() => {
        expect(mockOnStateChange).toHaveBeenCalledWith(
          'test.property',
          expect.objectContaining({
            enum: ['option1']
          })
        );
      });
    });
  });

  /**
   * Test format selection for string types
   */
  describe('Format Selection', () => {
    it('should show format options for string type', () => {
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      expect(screen.getByText('Format')).toBeInTheDocument();
    });

    it('should not show format options for non-string types', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedPropertyEditor
          property={defaultProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const typeSelect = screen.getByRole('combobox', { name: /type/i });
      await user.click(typeSelect);
      await user.click(screen.getByText('Number'));

      expect(screen.queryByText('Format')).not.toBeInTheDocument();
    });
  });

  /**
   * Test object type handling
   */
  describe('Object Type Handling', () => {
    it('should handle object default values', async () => {
      const user = userEvent.setup();
      const objectProperty = {
        ...defaultProperty,
        type: 'object' as const,
        default: { key: 'value' }
      };

      render(
        <EnhancedPropertyEditor
          property={objectProperty}
          fieldPath="test.property"
          onStateChange={mockOnStateChange}
        />
      );

      const jsonTextarea = screen.getByDisplayValue(/"key": "value"/);
      expect(jsonTextarea).toBeInTheDocument();
    });
  });
});