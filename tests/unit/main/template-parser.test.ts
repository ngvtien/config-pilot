import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateParser } from '../../../src/main/services/template-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('TemplateParser', () => {
  let parser: TemplateParser;
  const testTemplateDir = path.join(__dirname, '../../fixtures/templates/simple-nginx');

  beforeEach(() => {
    parser = new TemplateParser();
  });

  it('should load and parse a valid template', async () => {
    // This test will work once we create the fixture
    const template = await parser.loadTemplate(testTemplateDir);
    
    expect(template.metadata.name).toBe('simple-nginx');
    expect(template.metadata.version).toBe('1.0.0');
    expect(template.resources.deployment).toBeDefined();
    expect(template.resources.deployment.kind).toBe('Deployment');
  });

  it('should throw error for missing metadata.json', async () => {
    const invalidPath = path.join(__dirname, 'non-existent');
    
    await expect(parser.loadTemplate(invalidPath))
      .rejects
      .toThrow('Template metadata not found');
  });

  it('should validate required fields', async () => {
    // Test with invalid template (missing name)
    const invalidTemplate = {
      metadata: { version: '1.0.0' },
      parameters: {},
      resources: { deployment: { apiVersion: 'apps/v1', kind: 'Deployment' } },
      generation: {}
    };
    
    expect(() => (parser as any).validateTemplate(invalidTemplate))
      .toThrow('Template metadata.name is required');
  });
});