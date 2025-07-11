import { describe, it, expect } from 'vitest';
import { normalizePath } from '@/renderer/components/template-creator/SchemaFieldSelectionModal';

/**
 * Test suite for the normalizePath function to ensure it correctly handles
 * both CRD and standard Kubernetes resources without double encoding
 */
describe('normalizePath Function', () => {
    
    describe('Standard Kubernetes Resources (non-CRD)', () => {
        const standardResource = {
            source: 'kubernetes',
            kind: 'Deployment',
            key: 'io.k8s.api.apps.v1.Deployment'
        };

        it('should return single path variation for standard resources', () => {
            const result = normalizePath('metadata.name', standardResource);
            expect(result).toEqual(['metadata.name']);
        });

        it('should not add spec prefix for standard resources', () => {
            const result = normalizePath('replicas', standardResource);
            expect(result).toEqual(['replicas']);
            expect(result).not.toContain('spec.replicas');
        });

        it('should handle spec field correctly for standard resources', () => {
            const result = normalizePath('spec', standardResource);
            expect(result).toEqual(['spec']);
            expect(result).not.toContain('spec.spec');
        });
    });

    describe('CRD Resources', () => {
        const crdResource = {
            source: 'cluster-crds',
            kind: 'Application',
            key: 'argoproj.io/v1alpha1/Application'
        };

        it('should handle spec field correctly without double encoding', () => {
            const result = normalizePath('spec', crdResource);
            expect(result).toEqual(['spec']);
            expect(result).not.toContain('spec.spec');
            expect(result).not.toContain('Application.spec.spec');
        });

        it('should add spec prefix for top-level CRD fields (except spec itself)', () => {
            const result = normalizePath('project', crdResource);
            expect(result).toContain('project');
            expect(result).toContain('spec.project');
            expect(result).toContain('Application.project');
            expect(result).toContain('Application.spec.project');
        });

        it('should handle spec-prefixed paths correctly', () => {
            const result = normalizePath('spec.project', crdResource);
            expect(result).toContain('spec.project');
            expect(result).toContain('project');
            expect(result).toContain('Application.spec.project');
            expect(result).toContain('Application.project');
        });

        it('should handle nested paths correctly', () => {
            const result = normalizePath('destination.name', crdResource);
            expect(result).toContain('destination.name');
            expect(result).not.toContain('spec.destination.name');
        });
    });

    describe('Edge Cases', () => {
        const crdResource = {
            source: 'cluster-crds',
            kind: 'Application',
            key: 'argoproj.io/v1alpha1/Application'
        };

        it('should handle empty path', () => {
            const result = normalizePath('', crdResource);
            expect(result).toEqual(['']);
        });

        it('should handle undefined resource', () => {
            const result = normalizePath('spec', undefined);
            expect(result).toEqual(['spec']);
        });

        it('should handle resource without kind', () => {
            const resourceWithoutKind = {
                source: 'cluster-crds'
            };
            const result = normalizePath('spec', resourceWithoutKind);
            expect(result).toEqual(['spec']);
        });
    });
});