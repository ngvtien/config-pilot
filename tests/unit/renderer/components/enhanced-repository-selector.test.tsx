import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedRepositorySelector } from '../../../../src/renderer/components/git/enhanced-repository-selector';
import { GitRepository } from '../../../../src/shared/types/git-repository';

// Mock child components
vi.mock('../../../../src/renderer/components/git/git-repository-registration', () => ({
  GitRepositoryRegistration: ({ open, onSuccess }: any) => 
    open ? <div data-testid="registration-dialog">Registration Dialog</div> : null
}));

vi.mock('../../../../src/renderer/components/git/branch-management-dialog', () => ({
  BranchManagementDialog: ({ open, repository }: any) => 
    open ? <div data-testid="branch-dialog">Branch Dialog for {repository?.name}</div> : null
}));

vi.mock('../../../../src/renderer/components/git/gitops-structure-validator', () => ({
  GitOpsStructureValidator: ({ repository }: any) => 
    <div data-testid="gitops-validator">GitOps Validator for {repository?.name}</div>
}));

// Test data
const mockRepositories: GitRepository[] = [
  {
    id: '1',
    name: 'test-repo-1',
    url: 'https://github.com/test/repo1.git',
    branch: 'main',
    description: 'Test repository 1',
    permissions: { developer: 'full', devops: 'full', operations: 'read-only' },
    authStatus: 'success'
  },
  {
    id: '2',
    name: 'test-repo-2',
    url: 'https://gitlab.com/test/repo2.git',
    branch: 'develop',
    description: 'Test repository 2',
    permissions: { developer: 'read-only', devops: 'full', operations: 'full' },
    authStatus: 'failed'
  }
];

// Mock functions
const mockGetRepositoriesByPermission = vi.fn((role: string, level: string) => mockRepositories);
const mockTestConnection = vi.fn().mockResolvedValue(true);
const mockOnChange = vi.fn();
const mockOnCreateBranch = vi.fn();

describe('EnhancedRepositorySelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test basic rendering and repository display
   */
  it('renders repository cards with correct information', () => {
    render(
      <EnhancedRepositorySelector
        repositories={mockRepositories}
        getRepositoriesByPermission={mockGetRepositoriesByPermission}
        testConnection={mockTestConnection}
        value=""
        onChange={mockOnChange}
        onCreateBranch={mockOnCreateBranch}
      />
    );

    expect(screen.getByText('test-repo-1')).toBeInTheDocument();
    expect(screen.getByText('test-repo-2')).toBeInTheDocument();
    expect(screen.getByText('Test repository 1')).toBeInTheDocument();
    expect(screen.getByText('github.com')).toBeInTheDocument();
    expect(screen.getByText('gitlab.com')).toBeInTheDocument();
  });

  /**
   * Test repository selection functionality
   */
  it('calls onChange when repository is selected', async () => {
    render(
      <EnhancedRepositorySelector
        repositories={mockRepositories}
        getRepositoriesByPermission={mockGetRepositoriesByPermission}
        testConnection={mockTestConnection}
        value=""
        onChange={mockOnChange}
        onCreateBranch={mockOnCreateBranch}
      />
    );

    const repoCard = screen.getByText('test-repo-1').closest('[role="button"], div');
    if (repoCard) {
      fireEvent.click(repoCard);
      expect(mockOnChange).toHaveBeenCalledWith('https://github.com/test/repo1.git');
    }
  });

  /**
   * Test search functionality
   */
  it('filters repositories based on search term', async () => {
    const user = userEvent.setup();
    render(
      <EnhancedRepositorySelector
        repositories={mockRepositories}
        getRepositoriesByPermission={mockGetRepositoriesByPermission}
        testConnection={mockTestConnection}
        value=""
        onChange={mockOnChange}
        onCreateBranch={mockOnCreateBranch}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search repositories...');
    await user.type(searchInput, 'repo-1');

    expect(screen.getByText('test-repo-1')).toBeInTheDocument();
    expect(screen.queryByText('test-repo-2')).not.toBeInTheDocument();
  });

  /**
   * Test connection testing
   */
  it('handles connection testing', async () => {
    render(
      <EnhancedRepositorySelector
        repositories={mockRepositories}
        getRepositoriesByPermission={mockGetRepositoriesByPermission}
        testConnection={mockTestConnection}
        value=""
        onChange={mockOnChange}
        onCreateBranch={mockOnCreateBranch}
      />
    );

    const testButtons = screen.getAllByText('Test');
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalledWith('https://github.com/test/repo1.git');
    });
  });

  /**
   * Test branch creation dialog
   */
  it('opens branch creation dialog', async () => {
    render(
      <EnhancedRepositorySelector
        repositories={mockRepositories}
        getRepositoriesByPermission={mockGetRepositoriesByPermission}
        testConnection={mockTestConnection}
        value=""
        onChange={mockOnChange}
        onCreateBranch={mockOnCreateBranch}
      />
    );

    const branchButtons = screen.getAllByText('Branch');
    fireEvent.click(branchButtons[0]);

    expect(screen.getByTestId('branch-dialog')).toBeInTheDocument();
    expect(screen.getByText('Branch Dialog for test-repo-1')).toBeInTheDocument();
  });

  /**
   * Test add new repository
   */
  it('opens registration dialog when add new is clicked', () => {
    render(
      <EnhancedRepositorySelector
        repositories={mockRepositories}
        getRepositoriesByPermission={mockGetRepositoriesByPermission}
        testConnection={mockTestConnection}
        value=""
        onChange={mockOnChange}
        onCreateBranch={mockOnCreateBranch}
      />
    );

    const addButton = screen.getByText('Add New');
    fireEvent.click(addButton);

    expect(screen.getByTestId('registration-dialog')).toBeInTheDocument();
  });

  /**
   * Test GitOps validation display
   */
  it('shows GitOps validator when repository is selected', () => {
    render(
      <EnhancedRepositorySelector
        repositories={mockRepositories}
        getRepositoriesByPermission={mockGetRepositoriesByPermission}
        testConnection={mockTestConnection}
        value="https://github.com/test/repo1.git"
        onChange={mockOnChange}
        onCreateBranch={mockOnCreateBranch}
        showGitOpsValidation={true}
      />
    );

    expect(screen.getByTestId('gitops-validator')).toBeInTheDocument();
  });

  /**
   * Test empty state
   */
  it('shows empty state when no repositories available', () => {
    render(
      <EnhancedRepositorySelector
        repositories={[]}
        getRepositoriesByPermission={vi.fn().mockReturnValue([])}
        testConnection={mockTestConnection}
        value=""
        onChange={mockOnChange}
        onCreateBranch={mockOnCreateBranch}
      />
    );

    expect(screen.getByText('No repositories configured')).toBeInTheDocument();
    expect(screen.getByText('Register your first repository')).toBeInTheDocument();
  });
});