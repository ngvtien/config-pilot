import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateOrchestrator } from '../../../../src/main/services/template-orchestrator';
import { TemplateService } from '../../../../src/main/services/template-service';
import type { EnhancedTemplate } from '../../../../src/shared/types/enhanced-template';

// Mock dependencies
vi.mock('../../../../src/main/services/template-service');
vi.mock('../../../../src/main/services/template-parser');
vi.mock('../../../../src/main/services/template-engine');
vi.mock('../../../../src/main/services/yaml-generator');
//vi.mock('../../../../src/main/file-service');
// vi.mock('../../../src/main/file-service', () => ({
//   FileService: vi.fn().mockImplementation(() => ({
//     // Mock any FileService methods that TemplateOrchestrator might use
//     writeFile: vi.fn().mockResolvedValue(undefined),
//     readFile: vi.fn().mockResolvedValue('{}'),
//     exists: vi.fn().mockResolvedValue(true),
//     ensureDir: vi.fn().mockResolvedValue(undefined)
//   }))
// }));

// Add this mock before the describe block
vi.mock('../../../../src/main/file-service', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    exists: vi.fn().mockResolvedValue(true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    getProjectsDir: vi.fn().mockReturnValue('/mock/projects'),
    getRecentProjectsFile: vi.fn().mockReturnValue('/mock/recent-projects.json')
  }))
}));

describe('TemplateOrchestrator Unit Tests', () => {
  let orchestrator: TemplateOrchestrator;
  let mockTemplateService: vi.Mocked<TemplateService>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock template service
    mockTemplateService = {
      saveTemplate: vi.fn(),
      loadTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      listTemplates: vi.fn(),
      validateTemplate: vi.fn()
    } as any;
    
    orchestrator = new TemplateOrchestrator(mockTemplateService);
  });

  describe('Constructor', () => {
    it('should initialize with template service dependency', () => {
      expect(orchestrator).toBeInstanceOf(TemplateOrchestrator);
    });
  });

  describe('generateFromTemplate', () => {
    it('should accept template object directly', async () => {
      const template: EnhancedTemplate = {
        id: 'test-template',
        name: 'test',
        version: '1.0.0',
        description: 'Test template',
        category: 'test',
        resources: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedBy: 'test'
        }
      };

      // Mock the internal methods to return success
      const result = await orchestrator.generateFromTemplate(
        template,
        {},
        { format: 'yaml', outputPath: '/test' }
      );

      // Should not call templateService.loadTemplate when template object is provided
      expect(mockTemplateService.loadTemplate).not.toHaveBeenCalled();
    });

    it('should load template by ID when string is provided', async () => {
      const templateId = 'test-template-id';
      const mockTemplate: EnhancedTemplate = {
        id: templateId,
        name: 'test',
        version: '1.0.0',
        description: 'Test template',
        category: 'test',
        resources: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedBy: 'test'
        }
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);

      await orchestrator.generateFromTemplate(
        templateId,
        {},
        { format: 'yaml', outputPath: '/test' }
      );

      expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith(templateId);
    });
  });

  describe('exportTemplate', () => {
    it('should export template with metadata', async () => {
      const templateId = 'test-template';
      const mockTemplate: EnhancedTemplate = {
        id: templateId,
        name: 'test',
        version: '1.0.0',
        description: 'Test template',
        category: 'test',
        resources: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedBy: 'test'
        }
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);

      const exportData = await orchestrator.exportTemplate(templateId);

      expect(exportData.template).toEqual(mockTemplate);
      expect(exportData.metadata).toHaveProperty('exportedAt');
      expect(exportData.metadata).toHaveProperty('exportedBy');
      expect(exportData.metadata).toHaveProperty('version');
    });
  });

  describe('importTemplate', () => {
    it('should import template and return the imported template', async () => {
    const exportData = {
      template: {
        id: 'original-id',
        name: 'test-template',
        version: '1.0.0',
        description: 'Test template',
        category: 'test',
        resources: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedBy: 'test'
        }
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'test',
        version: '1.0.0'
      }
    };

    // Mock template service to return null (no conflict)
    mockTemplateService.loadTemplate.mockResolvedValue(null);

    const importedTemplate = await orchestrator.importTemplate(exportData);

    expect(importedTemplate.name).toBe(exportData.template.name);
    expect(importedTemplate.id).toBe(exportData.template.id); // Should preserve original ID when no conflict
  });

    it('should handle ID conflicts by generating new ID', async () => {
      const exportData = {
        template: {
          id: 'existing-id',
          name: 'test-template',
          version: '1.0.0',
          description: 'Test template',
          category: 'test',
          resources: [],
          metadata: {
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedBy: 'test'
          }
        },
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'test',
          version: '1.0.0'
        }
      };

      // Mock template service to return existing template (conflict)
      mockTemplateService.loadTemplate.mockResolvedValue(exportData.template as EnhancedTemplate);

      const importedTemplate = await orchestrator.importTemplate(exportData);

      expect(importedTemplate.id).not.toBe(exportData.template.id);
      expect(importedTemplate.name).toContain('(Imported)');
    });
  });
});