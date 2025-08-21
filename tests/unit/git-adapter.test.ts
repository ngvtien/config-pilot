import { describe, it, expect } from 'vitest';
import { GitAdapterFactory } from '../../src/main/services/adapters/git-adapter-factory';
import { IsomorphicGitAdapter } from '../../src/main/services/adapters/isomorphic-git-adapter';

describe('GitAdapterFactory', () => {
  it('should return isomorphic-git adapter by default', () => {
    const adapter = GitAdapterFactory.getDefaultAdapter();
    expect(adapter).toBeInstanceOf(IsomorphicGitAdapter);
  });

  it('should return isomorphic-git adapter when requested', () => {
    const adapter = GitAdapterFactory.getAdapter('isomorphic-git');
    expect(adapter).toBeInstanceOf(IsomorphicGitAdapter);
  });

  it('should throw error for unsupported adapter type', () => {
    expect(() => {
      // @ts-ignore - testing invalid type
      GitAdapterFactory.getAdapter('invalid-adapter');
    }).toThrow('Unsupported Git adapter type: invalid-adapter');
  });
});

describe('IsomorphicGitAdapter', () => {
  const adapter = new IsomorphicGitAdapter();

  it('should have all required methods', () => {
    expect(typeof adapter.clone).toBe('function');
    expect(typeof adapter.testConnection).toBe('function');
    expect(typeof adapter.getRepositoryInfo).toBe('function');
    expect(typeof adapter.listRemote).toBe('function');
    expect(typeof adapter.getDiff).toBe('function');
    expect(typeof adapter.getStagedDiff).toBe('function');
    expect(typeof adapter.getBranches).toBe('function');
    expect(typeof adapter.checkout).toBe('function');
    expect(typeof adapter.checkoutNewBranch).toBe('function');
    expect(typeof adapter.add).toBe('function');
    expect(typeof adapter.commit).toBe('function');
    expect(typeof adapter.push).toBe('function');
    expect(typeof adapter.pull).toBe('function');
  });
});