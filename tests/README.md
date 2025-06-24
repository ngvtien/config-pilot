## Separate by Test Type First

```plaintext
tests/
├── unit/
│   ├── main/
│   │   ├── services/
│   │   │   └── schema-service.test.ts
│   │   └── ipc-handlers.test.ts
│   └── renderer/
│       ├── services/
│       │   └── kubernetes-schema-indexer.test.ts
│       └── components/
│           └── TemplateDesigner.test.tsx
├── integration/
│   ├── main/
│   │   └── services/
│   │       └── schema-service.integration.test.ts
│   └── renderer/
│       └── services/
│           └── kubernetes-indexer.integration.test.ts
└── e2e/
    ├── template-generation.e2e.test.ts
    └── helm-workflow.e2e.test.ts
```

## Test Type Guidelines
### Unit Tests
- Purpose : Test individual functions/classes in isolation
- Scope : Single component, service, or utility
- Dependencies : Mocked/stubbed
- Speed : Fast (< 100ms per test)
Examples for your project:

```typescript
// tests/unit/renderer/services/kubernetes-schema-indexer.test.ts
describe('KubernetesSchemaIndexer', () => {
  it('should extract correct apiVersion from x-kubernetes-group-version-kind', () => {
    // Test the createKubernetesResourceSchema function
  });
});

// tests/unit/main/services/schema-service.test.ts
describe('SchemaService', () => {
  it('should correctly parse RBAC apiVersion', () => {
    // Test extractApiVersionFromKey method
  });
});
```

### Integration Tests
- Purpose : Test interaction between components
- Scope : Multiple components working together
- Dependencies : Real or realistic test doubles
- Speed : Moderate (< 5s per test)

### Examples for your project:

```typescript
// tests/integration/renderer/services/kubernetes-indexer.integration.test.ts
describe('Kubernetes Schema Integration', () => {
  it('should correctly process backend schema data end-to-end', () => {
    // Test full flow: backend response → indexer → template generation
  });
});

// tests/integration/main/services/schema-service.integration.test.ts
describe('Schema Service Integration', () => {
  it('should load and process real CRD definitions', () => {
    // Test with actual CRD files
  });
});
```

## Recommended Approach
1. Clear separation of test execution strategies
2. Different CI/CD pipelines can run different test types
3. Performance optimization - run fast unit tests first
4. Tool configuration is easier (different timeouts, reporters)

### File Naming Conventions:
```
*.test.ts               // Unit tests
*.integration.test.ts   // Integration tests
*.e2e.test.ts           // End-to-end tests
*.spec.ts               // Alternative for unit tests

// Separate directory
tests/unit/schema-service.test.ts
tests/integration/kubernetes-indexer.test.ts

// Co-located
src/services/schema-service.test.ts
src/components/TemplateDesigner.test.tsx
```

## Package.json Scripts:
```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test tests/e2e",
    "test:watch": "vitest watch tests/unit"
  }
}
```

## Test Configuration:

```typescript
// vitest.config.ts
export default {
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**/*'],
    timeout: {
      unit: 5000,
      integration: 30000
    }
  }
}
```

## How Configuration Files Are Discovered
### vitest.config.ts
Discovery Process:

1. Automatic Detection - Vitest automatically looks for config files in this order:
   
   - vitest.config.ts
   - vitest.config.js
   - vite.config.ts (fallback)
   - vite.config.js (fallback)

2. When It's Used:
```bash
npm run test:unit     # Uses vitest.config.ts
npm run test:integration  # Uses vitest.config.ts
vitest run           # Uses vitest.config.ts
```

3. Not Used During:

- npm run build (main app build)
- npm run dev (development server)
- Production builds

### playwright.config.ts
Discovery Process:

1. Automatic Detection - Playwright looks for:
   
   - playwright.config.ts
   - playwright.config.js
   - .config/playwright.config.ts
2. When It's Used:

```bash
npm run test:e2e     # Uses playwright.config.ts
playwright test      # Uses playwright.config.ts
npx playwright test  # Uses playwright.config.ts
```
3. Not Used During:

- Main application builds
- Unit/integration tests
- Development server

## Build vs Test Separation
### Main Application Build (npm run build)
Uses these configs:

- vite.config.ts - For bundling the renderer
- tsconfig.json - For TypeScript compilation
- electron-builder.json - For packaging
### Test Execution
Uses separate configs:

- vitest.config.ts - For unit/integration tests
- playwright.config.ts - For E2E tests

## Configuration File Precedence
### Vitest Configuration Hierarchy:
```plaintext
1. vitest.config.ts (highest priority)
2. vitest.config.js
3. vite.config.ts (if no vitest config found)
4. vite.config.js
5. Default vitest settings
```

### Playwright Configuration Hierarchy:
```plaintext
1. playwright.config.ts (highest priority)
2. playwright.config.js
3. Default playwright settings
```

## Example: How Your Package.json Scripts Work
Looking at your current package.json :

```json
{
  "scripts": {
    "build": "tsc -b && vite build",           // Uses vite.config.ts
    "test:unit": "vitest run tests/unit",      // Uses vitest.config.ts
    "test:e2e": "playwright test tests/e2e"    // Uses playwright.config.ts
  }
}
```

What happens when you run each:

1. npm run build :
   
   - TypeScript compiler uses tsconfig.json
   - Vite uses vite.config.ts
   - Does NOT use test configs
2. npm run test:unit :
   
   - Vitest uses vitest.config.ts
   - Does NOT affect main build
3. npm run test:e2e :
   
   - Playwright uses playwright.config.ts
   - Does NOT affect main build
## Manual Configuration Override
You can also specify config files explicitly:
```bash
# Custom vitest config
vitest run --config custom-vitest.config.ts

# Custom playwright config
playwright test --config custom-playwright.config.ts
```

## Key Takeaway
Test configurations are completely separate from build configurations. They only activate when you run their respective test commands, ensuring your production builds remain clean and optimized while providing rich testing capabilities during development.

This separation allows you to:

- Have different environments for testing vs production
- Use test-specific plugins and settings
- Keep test dependencies out of production bundles
- Run tests independently of the main application build

## Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- schema-service.test.ts

# Run integration tests only
npm test -- --testPathPattern=integration
```