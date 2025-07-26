import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BranchManagementDialog } from '../../../../src/renderer/components/git/branch-management-dialog';
import { GitRepository } from '../../../../src/shared/types/git-repository';

const mockRepository: GitRepository = {
  id: '1',
  name: 'test-branch-repo',
  url: 'https://github.com/test/branch-repo.git',
  branch: 'main',
  description: 'Test branch repository',
  permissions: { developer: 'full', devops: 'full', operations: 'read-only' },
  authStatus: 'success'
};

describe('BranchManagementDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test dialog rendering when open
   */
  it('renders dialog when open is true', () => {
    render(
      <BranchManagementDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        repository={mockRepository}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Create New Branch')).toBeInTheDocument();
    expect(screen.getByText('test-branch-repo')).toBeInTheDocument();
  });

  /**
   * Test dialog not rendering when closed
   */
  it('does not render dialog when open is false', () => {
    render(
      <BranchManagementDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        repository={mockRepository}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByText('Create New Branch')).not.toBeInTheDocument();
  });

  /**
   * Test branch type selection
   */
  it('allows selecting different branch types', async () => {
    const user = userEvent.setup();
    render(
      <BranchManagementDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        repository={mockRepository}
        onSuccess={mockOnSuccess}
      />
    );

    const environmentRadio = screen.getByLabelText('Environment');
    await user.click(environmentRadio);

    expect(environmentRadio).toBeChecked();
  });

  /**
   * Test branch name generation
   */
  it('generates branch name based on type and input', async () => {
    const user = userEvent.setup();
    render(
      <BranchManagementDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        repository={mockRepository}
        onSuccess={mockOnSuccess}
      />
    );

    const branchNameInput = screen.getByPlaceholderText('Enter feature name...');
    await user.type(branchNameInput, 'new-feature');

    await waitFor(() => {
      // Use getAllByText to handle multiple elements with same text
      const elements = screen.getAllByText(/feature\/new-feature/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test form submission
   */
  it('handles branch creation on form submit', async () => {
    const user = userEvent.setup();
    render(
      <BranchManagementDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        repository={mockRepository}
        onSuccess={mockOnSuccess}
      />
    );

    const branchNameInput = screen.getByPlaceholderText('Enter feature name...');
    await user.type(branchNameInput, 'test-branch');

    const createButton = screen.getByText('Create Branch');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(
        'https://github.com/test/branch-repo.git',
        'feature/test-branch'
      );
    }, { timeout: 3000 });
  });

  /**
   * Test cancel functionality
   */
  it('calls onOpenChange when cancel is clicked', async () => {
    render(
      <BranchManagementDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        repository={mockRepository}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  /**
   * Test advanced options
   */
  it('shows and handles advanced options', async () => {
    const user = userEvent.setup();
    render(
      <BranchManagementDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        repository={mockRepository}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Advanced Options')).toBeInTheDocument();
    
    const createPRCheckbox = screen.getByLabelText('Create pull request template');
    expect(createPRCheckbox).toBeChecked(); // Should be checked by default

    await user.click(createPRCheckbox);
    expect(createPRCheckbox).not.toBeChecked();
  });

  /**
   * Test preview section
   */
  it('shows preview when branch name is entered', async () => {
    const user = userEvent.setup();
    render(
      <BranchManagementDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        repository={mockRepository}
        onSuccess={mockOnSuccess}
      />
    );

    const branchNameInput = screen.getByPlaceholderText('Enter feature name...');
    await user.type(branchNameInput, 'preview-test');

    await waitFor(() => {
      expect(screen.getByText('Preview:')).toBeInTheDocument();
      // Use getAllByText to handle multiple elements with same text
      const elements = screen.getAllByText(/feature\/preview-test/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});