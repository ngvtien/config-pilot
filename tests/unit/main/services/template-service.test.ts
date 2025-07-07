import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Mock Electron app FIRST - before any other imports
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data')
  }
}));

// Mock fs module
vi.mock('fs', () => {
  const mockPromises = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    access: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([])
  };
  
  return {
    default: {
      promises: mockPromises
    },
    promises: mockPromises
  };
});

// Mock path module
vi.mock('path', () => {
  const mockPath = {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/')),
    basename: vi.fn((path, ext) => {
      const name = path.split('/').pop() || '';
      return ext ? name.replace(ext, '') : name;
    }),
    extname: vi.fn((path) => {
      const parts = path.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    })
  };
  
  return {
    default: mockPath,
    ...mockPath
  };
});

// Import after mocking
const { TemplateService } = await import('../../../../src/main/services/template-service');
const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

/**
 * Mock template data for testing
 */
const createMockTemplate = () => ({
  id: 'test-template-id',
  name: 'Test Template',
  description: 'A test template for unit testing',
  version: '1.0.0',
  resources: [
    {
      id: 'deployment-resource',
      kind: 'Deployment',
      apiVersion: 'apps/v1',
      selectedFields: [
        {
          path: 'metadata.name',
          title: 'Name',
          type: 'string' as const,
          required: true,
          templateType: 'kubernetes' as const
        },
        {
          path: 'spec.replicas',
          title: 'Replicas',
          type: 'integer' as const,
          required: false,
          default: 1,
          templateType: 'kubernetes' as const
        }
      ],
      templateType: 'kubernetes' as const
    }
  ],
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    author: 'Test Author'
  }
});

/**
 * Mock CPT file format for testing
 */
const createMockCPTFile = () => {
  const template = createMockTemplate();
  return {
    fileFormat: {
      version: '1.0.0',
      type: 'config-pilot-template',
      generator: 'config-pilot',
      generatedAt: '2024-01-01T00:00:00.000Z'
    },
    template,
    checksum: 'd717b5bc1362b99833b2abdde39116830ab0435f0c1ad654c3f15105c1a7759f' // Fixed checksum
  };
};

/**
 * Mock context data for testing
 */
const createMockContext = () => ({
  environment: 'dev',
  instance: 1,
  product: 'test-product',
  customer: 'test-customer',
  version: '1.0.0',
  baseHostUrl: 'https://test.example.com'
});

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify(createMockCPTFile()));
    mockFs.access.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue(['test-template-id.cpt']);
    
    // Reset path mocks
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.dirname.mockImplementation((path) => path.split('/').slice(0, -1).join('/'));
    mockPath.basename.mockImplementation((path, ext) => {
      const name = path.split('/').pop() || '';
      return ext ? name.replace(ext, '') : name;
    });
    
    templateService = new TemplateService();
    await templateService.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    /**
     * Test template service initialization
     */
    it('should initialize template service and create directories', async () => {
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('templates'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('collections'),
        { recursive: true }
      );
    });

    /**
     * Test template cache loading during initialization
     */
    it('should load existing templates into cache during initialization', async () => {
      const templates = await templateService.getTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('test-template-id');
    });
  });

  describe('template management', () => {
    /**
     * Test saving a new template
     */
    it('should save template successfully', async () => {
      const mockTemplate = createMockTemplate();
      mockTemplate.id = 'new-template-id';
      
      await templateService.saveTemplate(mockTemplate);
      
      // Fixed: Check for actual JSON structure instead of StringContaining
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('new-template-id.cpt'),
        expect.any(String), // Accept any string content
        'utf-8'
      );
      
      // Verify the content contains expected data
      const writeCall = mockFs.writeFile.mock.calls[0];
      const content = writeCall[1] as string;
      expect(content).toContain('"name": "Test Template"');
    });

    /**
     * Test loading a template by ID
     */
    it('should load template by ID', async () => {
      const template = await templateService.loadTemplate('test-template-id');
      
      expect(template).toBeDefined();
      expect(template?.id).toBe('test-template-id');
      expect(template?.name).toBe('Test Template');
    });

    /**
     * Test loading non-existent template returns null
     */
    it('should return null for non-existent template', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      const template = await templateService.loadTemplate('non-existent-id');
      
      expect(template).toBeNull();
    });

    /**
     * Test listing all templates
     */
    it('should get all templates', async () => {
      const templates = await templateService.getTemplates();
      
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('test-template-id');
    });

    /**
     * Test deleting a template
     */
    it('should delete template successfully', async () => {
      await templateService.deleteTemplate('test-template-id');
      
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test-template-id.cpt')
      );
    });

    /**
     * Test creating a new template
     */
    it('should create template successfully', async () => {
      const templateData = {
        name: 'New Template',
        description: 'A new test template',
        version: '1.0.0',
        resources: [ // Fixed: Add required resources
          {
            id: 'test-resource',
            kind: 'Deployment',
            apiVersion: 'apps/v1',
            selectedFields: [],
            templateType: 'kubernetes' as const
          }
        ]
      };
      
      const createdTemplate = await templateService.createTemplate(templateData);
      
      expect(createdTemplate.id).toBeDefined();
      expect(createdTemplate.name).toBe('New Template');
      expect(createdTemplate.metadata).toBeDefined();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('template import/export', () => {
    /**
     * Test template export
     */
    it('should export template successfully', async () => {
      const exportPath = '/mock/export/template.cpt';
      
      await templateService.exportTemplate('test-template-id', exportPath);
      
      // Fixed: Check for actual JSON structure instead of StringContaining
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        exportPath,
        expect.any(String), // Accept any string content
        'utf-8'
      );
      
      // Verify the content contains expected data
      const writeCall = mockFs.writeFile.mock.calls[0];
      const content = writeCall[1] as string;
      expect(content).toContain('"type": "config-pilot-template"');
    });

    /**
     * Test template export with non-existent template
     */
    it('should handle export of non-existent template', async () => {
      vi.spyOn(templateService, 'loadTemplate').mockResolvedValue(null);
      
      await expect(
        templateService.exportTemplate('non-existent-id', '/mock/export/template.cpt')
      ).rejects.toThrow('Template non-existent-id not found');
    });

    /**
     * Test template import
     */
    it('should import template successfully', async () => {
      const importPath = '/mock/import/template.cpt';
      const mockCPTFile = createMockCPTFile();
      
      // Mock the generateChecksum method to return the expected checksum
      vi.spyOn(templateService as any, 'generateChecksum').mockReturnValue(mockCPTFile.checksum);
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCPTFile));
      
      const importedTemplate = await templateService.importTemplate(importPath);
      
      expect(importedTemplate.name).toBe('Test Template');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    /**
     * Test template import with checksum mismatch
     */
    it('should handle import with checksum mismatch', async () => {
      const importPath = '/mock/import/template.cpt';
      const mockCPTFile = createMockCPTFile();
      mockCPTFile.checksum = 'invalid-checksum';
      
      // Mock generateChecksum to return a different value
      vi.spyOn(templateService as any, 'generateChecksum').mockReturnValue('different-checksum');
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockCPTFile));
      
      await expect(
        templateService.importTemplate(importPath)
      ).rejects.toThrow('Template file integrity check failed');
    });
  });


  describe('template search', () => {
    /**
     * Test template search by name
     */
    it('should search templates by name', async () => {
      const results = await templateService.searchTemplates('Test');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test Template');
    });

    /**
     * Test template search with no results
     */
    it('should return empty array for no search results', async () => {
      const results = await templateService.searchTemplates('NonExistent');
      
      expect(results).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    /**
     * Test file system error handling during save
     */
    it('should handle file system errors during save', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));
      
      const template = createMockTemplate();
      
      await expect(
        templateService.saveTemplate(template)
      ).rejects.toThrow('Disk full');
    });

    /**
     * Test file system error handling during delete
     */
    it('should handle file system errors during delete', async () => {
      mockFs.unlink.mockRejectedValue(new Error('Permission denied'));
      
      await expect(
        templateService.deleteTemplate('test-template-id')
      ).rejects.toThrow('Permission denied');
    });

    /**
     * Test generation error handling
     */
    it('should handle generation errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Directory creation failed'));
      
      const context = createMockContext();
      const result = await templateService.generateTemplate(
        'test-template-id',
        context,
        '/mock/output',
        'helm'
      );
      
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Directory creation failed');
    });
  });
});