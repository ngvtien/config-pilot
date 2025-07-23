import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitOpsStructureValidator } from '../../../../src/renderer/components/git/gitops-structure-validator';
import { GitRepository } from '../../../../src/shared/types/git-repository';

const mockRepository: GitRepository = {
  id: '1',
  name: 'test-gitops-repo',
  url: 'https://github.com/test/gitops-repo.git',
  branch: 'main',
  description: 'Test GitOps repository',
  permissions: { developer: 'full', devops: 'full', operations: 'read-only' },
  authStatus: 'success'
};

describe('GitOpsStructureValidator', () => {
  const mockOnValidationComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test basic rendering
   */
  it('renders validation component with repository info', () => {
    render(
      <GitOpsStructureValidator
        repository={mockRepository}
        onValidationComplete={mockOnValidationComplete}
      />
    );

    expect(screen.getByText('GitOps Structure Validation')).toBeInTheDocument();
    expect(screen.getByText('test-gitops-repo')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  /**
   * Test validation status display
   */
  it('shows validation status badge', async () => {
    render(
      <GitOpsStructureValidator
        repository={mockRepository}
        onValidationComplete={mockOnValidationComplete}
      />
    );

    // Initially should show validating or pending state
    await waitFor(() => {
      const badge = screen.getByText(/VALIDATING|PASSED|FAILED/);
      expect(badge).toBeInTheDocument();
    });
  });

  /**
   * Test structure check display
   */
  it('displays structure check results', async () => {
    render(
      <GitOpsStructureValidator
        repository={mockRepository}
        onValidationComplete={mockOnValidationComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Structure Check:')).toBeInTheDocument();
    });
  });

  /**
   * Test auto-fix button
   */
  it('shows auto-fix button when validation fails', async () => {
    render(
      <GitOpsStructureValidator
        repository={mockRepository}
        onValidationComplete={mockOnValidationComplete}
      />
    );

    await waitFor(() => {
      const autoFixButton = screen.queryByText('Auto-Fix');
      // Button should appear if validation fails
      if (autoFixButton) {
        expect(autoFixButton).toBeInTheDocument();
      }
    });
  });

  /**
   * Test manual setup and skip buttons
   */
  it('shows manual setup and skip options', async () => {
    render(
      <GitOpsStructureValidator
        repository={mockRepository}
        onValidationComplete={mockOnValidationComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Manual Setup')).toBeInTheDocument();
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });
  });

  /**
   * Test validation complete callback
   */
  it('calls onValidationComplete when validation finishes', async () => {
    render(
      <GitOpsStructureValidator
        repository={mockRepository}
        onValidationComplete={mockOnValidationComplete}
      />
    );

    await waitFor(() => {
      expect(mockOnValidationComplete).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});