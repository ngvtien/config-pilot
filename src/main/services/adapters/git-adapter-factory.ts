import { GitAdapterInterface } from './git-adapter-interface';
import { IsomorphicGitAdapter } from './isomorphic-git-adapter';

export type GitAdapterType = 'isomorphic-git';

/**
 * Factory for creating Git adapters
 * Supports different Git implementations for flexibility
 */
export class GitAdapterFactory {
  private static adapters: Map<GitAdapterType, GitAdapterInterface> = new Map();

  /**
   * Get Git adapter instance
   */
  static getAdapter(type: GitAdapterType = 'isomorphic-git'): GitAdapterInterface {
    if (!this.adapters.has(type)) {
      switch (type) {
        case 'isomorphic-git':
          this.adapters.set(type, new IsomorphicGitAdapter());
          break;
        default:
          throw new Error(`Unsupported Git adapter type: ${type}`);
      }
    }

    return this.adapters.get(type)!;
  }

  /**
   * Get default Git adapter
   */
  static getDefaultAdapter(): GitAdapterInterface {
    return this.getAdapter('isomorphic-git');
  }
}