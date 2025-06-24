import { test, expect } from '@playwright/test';

test.describe('Kubernetes Integration E2E', () => {
  test('should connect to Kubernetes cluster and load resources', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Kubernetes dashboard
    await page.click('[data-testid="kubernetes-dashboard-tab"]');
    
    // Select context (assuming test cluster is available)
    await page.selectOption('[data-testid="context-selector"]', 'test-context');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
    
    // Load resources
    await page.click('[data-testid="load-resources-button"]');
    
    // Verify resources are displayed
    await expect(page.locator('[data-testid="resources-table"]')).toBeVisible();
    
    // Test resource filtering
    await page.fill('[data-testid="resource-filter-input"]', 'deployment');
    await expect(page.locator('[data-testid="resource-row"]')).toContainText('Deployment');
  });
});