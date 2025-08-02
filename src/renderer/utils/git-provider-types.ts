/**
 * Git provider types and utilities
 */
export type GitProvider = 'github' | 'gitlab' | 'gitea' | 'bitbucket';

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: GitProvider): string {
  const names = {
    github: 'GitHub',
    gitlab: 'GitLab', 
    gitea: 'Gitea',
    bitbucket: 'Bitbucket'
  };
  return names[provider];
}

/**
 * Get provider icon for UI
 */
export function getProviderIcon(provider: GitProvider): string {
  const icons = {
    github: '🐙',
    gitlab: '🦊',
    gitea: '🍃',
    bitbucket: '🪣'
  };
  return icons[provider];
}