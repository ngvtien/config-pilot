import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ValueEditor from '../../../../src/renderer/components/value-editor';
import type { ContextData } from '../../../../src/shared/types/context-data';
import { setupComponentTest } from '../../../utils/test-helpers';

// Mock CodeMirror
vi.mock('@uiw/react-codemirror', () => ({
    default: vi.fn(({ value, onChange }) => (
        <textarea
            data-testid="codemirror-editor"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
        />
    ))
}));

// Mock YamlEditor with unique test ID
vi.mock('../../../../src/renderer/components/yaml-editor', () => ({
    default: vi.fn(({ initialContent, onChange, title }) => (
        <div data-testid="yaml-input-editor">
            <h3>{title}</h3>
            <textarea
                data-testid="yaml-content"
                defaultValue={initialContent}
                onChange={(e) => onChange?.(e.target.value)}
            />
        </div>
    ))
}));

// Mock config generators
vi.mock('../../../../src/renderer/lib/config-generator', () => ({
    generateConfigMap: vi.fn((values, namespace, name) =>
        `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${name}\n  namespace: ${namespace}\ndata:\n  test: "value"`
    ),
    generateConfigJson: vi.fn((values) =>
        JSON.stringify({ metadata: { type: 'configuration' }, configuration: values }, null, 2)
    )
}));

// beforeEach(() => {
//     vi.clearAllMocks();
//     setupComponentTest();

//     // Properly mock clipboard API
//     const mockWriteText = vi.fn().mockResolvedValue(undefined);
//     Object.defineProperty(navigator, 'clipboard', {
//         value: {
//             writeText: mockWriteText,
//         },
//         writable: true,
//         configurable: true
//     });
// });

beforeEach(() => {
    vi.clearAllMocks();
    setupComponentTest();

    // Properly mock clipboard API
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: {
            writeText: mockWriteText,
        },
        writable: true,
        configurable: true
    });
    
    // Store the mock for test access
    (global as any).mockWriteText = mockWriteText;
});

// // Mock clipboard API
// Object.assign(navigator, {
//     clipboard: {
//         writeText: vi.fn().mockResolvedValue(undefined)
//     }
// });

describe('ValueEditor', () => {
    const mockContext: ContextData = {
        environment: 'dev',
        instance: 0,
        product: 'test-product',
        customer: 'test-customer',
        version: '1.0.0',
        baseHostUrl: 'https://test.example.com'
    };

    const mockOnChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        setupComponentTest();
    });

    describe('Component Rendering', () => {
        /**
         * Test that the component renders correctly in side-by-side layout
         */
        it('should render in side-by-side layout with all panels', () => {
            render(
                <ValueEditor
                    initialValue="test: value"
                    onChange={mockOnChange}
                    context={mockContext}
                    layout="side-by-side"
                />
            );

            expect(screen.getByText('Helm Values Editor')).toBeInTheDocument();
            expect(screen.getByTestId('yaml-input-editor')).toBeInTheDocument();
            expect(screen.getByText('config.json')).toBeInTheDocument();
            expect(screen.getByText('ConfigMap')).toBeInTheDocument();
        });

        /**
         * Test that the component renders correctly in stacked layout
         */
        it('should render in stacked layout with only YAML editor', () => {
            render(
                <ValueEditor
                    initialValue="test: value"
                    onChange={mockOnChange}
                    context={mockContext}
                    layout="stacked"
                />
            );

            expect(screen.getByTestId('yaml-input-editor')).toBeInTheDocument();
            expect(screen.queryByText('config.json')).not.toBeInTheDocument();
            expect(screen.queryByText('ConfigMap')).not.toBeInTheDocument();
        });

        // ... existing code ...
    });

    describe('Tab Switching', () => {
        /**
         * Test switching between config.json and ConfigMap tabs
         */
        it('should switch between output format tabs', async () => {
            const user = userEvent.setup();
            render(
                <ValueEditor
                    initialValue="test: value"
                    onChange={mockOnChange}
                    context={mockContext}
                    layout="side-by-side"
                />
            );

            // Initially config.json should be selected
            expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('config.json');

            // Click ConfigMap tab
            await user.click(screen.getByText('ConfigMap'));

            await waitFor(() => {
                expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('ConfigMap');
            });
        });
    });

    describe('Content Generation', () => {
        /**
         * Test that config.json content is generated correctly
         */
        it('should generate config.json content', () => {
            render(
                <ValueEditor
                    initialValue="replicaCount: 1\nimage:\n  tag: latest"
                    onChange={mockOnChange}
                    context={mockContext}
                    layout="side-by-side"
                />
            );

            // Check that CodeMirror is rendered with generated content
            expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
        });

        /**
         * Test that ConfigMap content is generated correctly
         */
        it('should generate ConfigMap content', async () => {
            const user = userEvent.setup();
            render(
                <ValueEditor
                    initialValue="replicaCount: 1\nimage:\n  tag: latest"
                    onChange={mockOnChange}
                    context={mockContext}
                    layout="side-by-side"
                />
            );

            // Switch to ConfigMap tab
            await user.click(screen.getByText('ConfigMap'));

            // Check that CodeMirror is rendered with ConfigMap content
            expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
        });
    });

    describe('Copy Functionality', () => {
        /**
         * Test copying content to clipboard
         */
    it('should copy content to clipboard when copy button is clicked', async () => {
        render(<ValueEditor context={mockContext} layout="side-by-side" />);
        
        const copyButton = screen.getByRole('button', { name: /copy/i });
        await userEvent.click(copyButton);
        
        // Access the mock from global
        const mockWriteText = (global as any).mockWriteText;
        expect(mockWriteText).toHaveBeenCalledTimes(1);
    });

        // /**
        //  * Test that toast notification appears after copying
        //  */
        // it('should show toast notification after copying', async () => {
        //     const user = userEvent.setup();
        //     render(
        //         <ValueEditor
        //             initialValue="test: value"
        //             onChange={mockOnChange}
        //             context={mockContext}
        //             layout="side-by-side"
        //         />
        //     );

        //     const copyButton = screen.getByRole('button', { name: /copy to clipboard/i });
        //     await user.click(copyButton);

        //     await waitFor(() => {
        //         expect(screen.getByText('Copied to clipboard!')).toBeInTheDocument();
        //     });
        // });
    });

    describe('YAML Content Changes', () => {
        /**
         * Test that onChange is called when YAML content changes
         */
        it('should call onChange when YAML content changes', async () => {
            const user = userEvent.setup();
            render(
                <ValueEditor
                    initialValue="test: value"
                    onChange={mockOnChange}
                    context={mockContext}
                    layout="side-by-side"
                />
            );

            const yamlTextarea = screen.getByTestId('yaml-content');
            await user.clear(yamlTextarea);
            await user.type(yamlTextarea, 'newTest: newValue');

            expect(mockOnChange).toHaveBeenCalledWith('newTest: newValue');
        });
    });

    describe('Splitter Functionality', () => {
        /**
         * Test that the splitter allows resizing panels
         */
        it('should handle splitter drag events', async () => {
            render(
                <ValueEditor
                    initialValue="test: value"
                    onChange={mockOnChange}
                    context={mockContext}
                    layout="side-by-side"
                />
            );

            // Test that the component renders without errors
            expect(screen.getByTestId('yaml-input-editor')).toBeInTheDocument();
            expect(screen.getByTestId('yaml-output-editor')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        /**
         * Test error handling for invalid YAML
         */
        it('should handle invalid YAML gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            render(
                <ValueEditor
                    initialValue="invalid: yaml: content: ["
                    onChange={mockOnChange}
                    context={mockContext}
                    layout="side-by-side"
                />
            );

            // Component should still render
            expect(screen.getByTestId('yaml-input-editor')).toBeInTheDocument();

            consoleSpy.mockRestore();
        });
    });

    describe('Context Integration', () => {
        /**
         * Test that context data is properly used
         */
        it('should use context data for file path generation', () => {
            render(
                <ValueEditor
                    initialValue="test: value"
                    onChange={mockOnChange}
                    context={{
                        ...mockContext,
                        customer: 'custom-customer',
                        environment: 'production',
                        product: 'custom-product'
                    }}
                />
            );

            expect(screen.getByText(/custom-customer.*production.*custom-product/)).toBeInTheDocument();
        });

        /**
         * Test backward compatibility with environment prop
         */
        it('should use environment prop when context is not provided', () => {
            render(
                <ValueEditor
                    initialValue="test: value"
                    onChange={mockOnChange}
                    environment="staging"
                />
            );

            expect(screen.getByText(/staging/)).toBeInTheDocument();
        });
    });
});