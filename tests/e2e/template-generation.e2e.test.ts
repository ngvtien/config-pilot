import { test, expect } from '@playwright/test';

test.describe('Template Generation E2E', () => {
  test('should create and generate a complete Helm template', async ({ page }) => {
    // Navigate to template designer
    await page.goto('/');
    await page.click('[data-testid="template-designer-tab"]');
    
    // Select resource type
    await page.selectOption('[data-testid="resource-type-select"]', 'Deployment');
    
    // Enter template name
    await page.fill('[data-testid="template-name-input"]', 'my-app-deployment');
    
    // Configure basic properties
    await page.fill('[data-testid="app-name-input"]', 'my-app');
    await page.fill('[data-testid="replicas-input"]', '3');
    
    // Add container configuration
    await page.click('[data-testid="add-container-button"]');
    await page.fill('[data-testid="container-name-input"]', 'app-container');
    await page.fill('[data-testid="container-image-input"]', 'nginx:latest');
    
    // Generate template
    await page.click('[data-testid="generate-template-button"]');
    
    // Verify template is generated
    await expect(page.locator('[data-testid="generated-template"]')).toBeVisible();
    
    // Verify template content
    const templateContent = await page.textContent('[data-testid="generated-template"]');
    expect(templateContent).toContain('apiVersion: apps/v1');
    expect(templateContent).toContain('kind: Deployment');
    expect(templateContent).toContain('name: my-app-deployment');
    expect(templateContent).toContain('replicas: {{ .Values.deployment.replicas | default 3 }}');
  });

  test('should save and load template projects', async ({ page }) => {
    await page.goto('/');
    
    // Create a new project
    await page.click('[data-testid="new-project-button"]');
    await page.fill('[data-testid="project-name-input"]', 'Test Project');
    await page.click('[data-testid="create-project-button"]');
    
    // Create a template
    await page.click('[data-testid="template-designer-tab"]');
    await page.selectOption('[data-testid="resource-type-select"]', 'Service');
    await page.fill('[data-testid="template-name-input"]', 'my-service');
    
    // Save project
    await page.click('[data-testid="save-project-button"]');
    
    // Verify save success
    await expect(page.locator('[data-testid="save-success-message"]')).toBeVisible();
    
    // Load project
    await page.click('[data-testid="load-project-button"]');
    await page.selectOption('[data-testid="project-select"]', 'Test Project');
    
    // Verify template is loaded
    await expect(page.locator('[data-testid="template-name-input"]')).toHaveValue('my-service');
  });
});