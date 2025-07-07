import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateDesigner } from '../../../../../src/renderer/components/template-creator/TemplateDesigner';

describe('Schema Field Selection to Configuration Integration', () => {
    it('should allow direct configuration from field selection modal', async () => {
        // Test the enhanced flow
        render(<TemplateDesigner settingsData={undefined} contextData={undefined} />)
        
        // Open schema modal
        const configureButton = screen.getByText('Configure Fields')
        await user.click(configureButton)
        
        // Select fields
        const fieldCheckbox = screen.getByRole('checkbox', { name: /Service Type/ })
        await user.click(fieldCheckbox)
        
        // Click configure
        const configureFieldsButton = screen.getByText('Configure Fields (1)')
        await user.click(configureFieldsButton)
        
        // Verify configuration panel opens
        expect(screen.getByText('Service Type • spec.type')).toBeInTheDocument()
    })
})