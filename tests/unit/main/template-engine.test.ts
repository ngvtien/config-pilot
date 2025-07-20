import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../../../src/main/services/template-engine';
import { TemplateParser } from '../../../src/main/services/template-parser';
import * as path from 'path';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();
  const parser = new TemplateParser();
  const templateDir = path.join(__dirname, '../../fixtures/templates/simple-nginx');

  it('should resolve template placeholders with default values', async () => {
    const template = await parser.loadTemplate(templateDir);
    const resolved = engine.resolveTemplate(template, {});
    
    expect(resolved.resources.deployment.metadata.name).toBe('simple-nginx');
    expect(resolved.resources.deployment.spec.replicas).toBe(1);
    expect(resolved.resources.deployment.spec.template.spec.containers[0].image)
      .toBe('nginx:latest');
  });

  it('should resolve template placeholders with custom values', async () => {
    const template = await parser.loadTemplate(templateDir);
    const resolved = engine.resolveTemplate(template, {
      replicaCount: 3,
      image: { repository: 'custom-nginx', tag: 'v1.0' }
    });
    
    expect(resolved.resources.deployment.spec.replicas).toBe(3);
    expect(resolved.resources.deployment.spec.template.spec.containers[0].image)
      .toBe('custom-nginx:v1.0');
  });
});