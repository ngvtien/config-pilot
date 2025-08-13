# Product Requirements Document: Helm Chart Generation Workflow v2.0

## Executive Summary

This document outlines the redesigned Helm Chart generation workflow that leverages the IDE's native capabilities for file management and editing, with a focused modal only for OCI publishing operations.

### Key Changes from v1.0
- **Three-Phase Approach**: Resource Selection & Generation → IDE-Based Editing → Package & Publish
- **Resources Directory**: Temporary workspace for design-time manifest management
- **Selective Generation**: Choose specific resources for Helm chart inclusion
- **IDE Integration**: Maximize use of existing file tree, editor, and Git capabilities
- **Focused Modal**: Single-purpose OCI publishing interface

## Detailed Task Breakdown

### Epic 1: Folder Structure & Resource Management

#### Task 1.1: Create Resources Directory Structure
**Requirements:**
- Create `./resources/` directory in project root
- Implement automatic directory creation on first use
- Add `.gitignore` entry for `resources/` (design-time only)
- Support nested organization (optional: `resources/app/`, `resources/infra/`)

**Acceptance Criteria:**
- Directory auto-creates when user uploads first resource
- Git ignores resources directory by default
- Directory structure is consistent across projects

**Implementation Details:**
- Use existing file service APIs
- Integrate with project initialization
- Add configuration option for custom resource directory name

#### Task 1.2: Enhanced Smart File Tree with Upload/Delete
**Requirements:**
- **File Upload**: Drag-and-drop YAML files into resources directory
- **Bulk Upload**: Select multiple files via file picker
- **File Validation**: Ensure uploaded files are valid Kubernetes YAML
- **File Deletion**: Right-click context menu for file removal
- **Bulk Operations**: Multi-select for batch delete
- **Duplicate Handling**: Overwrite existing files with same name
- **Visual Feedback**: Toast notifications for upload/delete operations

**Acceptance Criteria:**
- Drag-and-drop works for single and multiple files
- File picker supports .yaml and .yml extensions
- Invalid YAML files show error messages
- Deleted files are immediately removed from tree
- Overwrite operations show simple toast notification
- All operations integrate with existing file tree UI

**Implementation Details:**
- Extend existing `smart-file-tree` component
- Use HTML5 drag-and-drop API
- Integrate with existing file validation service
- Add new context menu items
- Use existing toast notification system

#### Task 1.3: Resource Metadata Extraction
**Requirements:**
- Parse YAML files to extract Kubernetes resource metadata
- Store `kind`, `apiVersion`, `name`, `namespace` for each resource
- Categorize resources (app, infrastructure, config, etc.)
- Display metadata in file tree (icons, tooltips)
- Support multi-document YAML files

**Acceptance Criteria:**
- All standard Kubernetes resources are correctly identified
- Custom resources show generic "Custom" category
- Multi-document files show count indicator
- Metadata updates when files are modified
- Invalid resources show error indicators

**Implementation Details:**
- Use existing YAML parsing utilities
- Create resource metadata service
- Add metadata caching for performance
- Integrate with file watcher for auto-updates

### Epic 2: Helm Chart Generation Engine

#### Task 2.1: Resource Selection Interface
**Requirements:**
- Checkbox selection in enhanced file tree
- "Select All" / "Select None" bulk actions
- Filter by resource type (Deployment, Service, etc.)
- Filter by category (app, infrastructure, config)
- Show selection count and summary
- Remember last selection preferences

**Acceptance Criteria:**
- Individual and bulk selection works smoothly
- Filters update selection list in real-time
- Selection state persists across sessions
- Clear visual indication of selected items
- Selection summary shows resource breakdown

**Implementation Details:**
- Extend file tree with selection state management
- Add filter controls to file tree header
- Use local storage for selection persistence
- Create selection summary component

#### Task 2.2: Direct Helm Chart Generation
**Requirements:**
- Generate Helm chart files directly in project directory
- Create standard Helm directory structure (`Chart.yaml`, `values.yaml`, `templates/`)
- Convert selected Kubernetes resources to Helm templates
- Extract configurable values to `values.yaml`
- Generate `values.schema.json` for validation
- Create `_helpers.tpl` with common template functions
- Add `NOTES.txt` with deployment instructions

**Acceptance Criteria:**
- Generated chart passes `helm lint` validation
- All selected resources are properly templated
- Values extraction follows Helm best practices
- Chart metadata includes project information
- Generated files open automatically in IDE

**Implementation Details:**
- Use existing Helm generation utilities
- Integrate with project metadata service
- Create template transformation engine
- Add automatic file opening after generation

#### Task 2.3: Incremental Generation Support
**Requirements:**
- Detect existing Helm chart files
- Offer merge or overwrite options for existing files
- Preserve custom modifications in templates
- Update `values.yaml` without losing custom values
- Maintain version history through Git

**Acceptance Criteria:**
- Existing charts are detected automatically
- User can choose merge strategy per file type
- Custom template modifications are preserved
- Values file merging is intelligent and safe
- All changes are Git-trackable

**Implementation Details:**
- Create file diff and merge utilities
- Add conflict resolution interface
- Use Git for change tracking
- Implement smart YAML merging

### Epic 3: IDE Integration

#### Task 3.1: File Tree Integration
**Requirements:**
- Show generated Helm files in main file tree
- Add Helm-specific file icons and indicators
- Enable standard IDE operations (edit, rename, delete)
- Support file navigation and search
- Integrate with existing Git status indicators

**Acceptance Criteria:**
- Helm files appear immediately after generation
- File icons clearly indicate Helm chart structure
- All standard file operations work correctly
- Search includes Helm chart content
- Git status shows for all generated files

**Implementation Details:**
- Extend existing file tree component
- Add Helm file type detection
- Create Helm-specific icons
- Integrate with search indexing

#### Task 3.2: Enhanced Editor Support
**Requirements:**
- YAML syntax highlighting for Helm templates
- Go template syntax support in YAML files
- Auto-completion for Helm functions and values
- Real-time validation for Helm templates
- Schema validation for `values.yaml`
- Integrated help for Helm template functions

**Acceptance Criteria:**
- Template syntax is properly highlighted
- Auto-completion works for `.Values` references
- Validation errors show inline
- Help tooltips appear for Helm functions
- Schema validation prevents invalid values

**Implementation Details:**
- Extend Monaco Editor configuration
- Add Helm template language support
- Create custom auto-completion provider
- Integrate with Helm validation service

#### Task 3.3: Git Integration Enhancement
**Requirements:**
- Auto-stage generated Helm files
- Provide meaningful commit messages for chart generation
- Support branch creation for chart updates
- Enable pull request creation for chart changes
- Track chart version changes in Git history

**Acceptance Criteria:**
- Generated files are automatically staged
- Commit messages include chart version and changes
- Branch creation works for chart updates
- PR creation includes chart validation results
- Git history clearly shows chart evolution

**Implementation Details:**
- Extend existing Git service
- Add Helm-specific commit message templates
- Integrate with PR creation workflows
- Add chart version tracking

### Epic 4: Package & Publish

#### Task 4.1: Focused OCI Publishing Modal
**Requirements:**
- Single-purpose modal for chart packaging and publishing
- Chart version management (semantic versioning)
- OCI registry configuration and authentication
- Package validation before publishing
- Publishing progress and status feedback
- Support for multiple registry targets

**Acceptance Criteria:**
- Modal opens with current chart context
- Version management follows semantic versioning
- Registry authentication is secure and persistent
- Validation catches issues before publishing
- Progress feedback is clear and actionable
- Multiple registries can be configured

**Implementation Details:**
- Create focused modal component
- Integrate with existing OCI service
- Add version management utilities
- Create publishing progress tracker

#### Task 4.2: Chart Packaging
**Requirements:**
- Package chart into `.tgz` format
- Include all necessary chart files
- Validate chart structure and content
- Generate chart index for repository
- Support chart signing (optional)
- Create package manifest

**Acceptance Criteria:**
- Packaged charts are valid Helm packages
- All required files are included
- Validation prevents broken packages
- Index generation works correctly
- Signing integration is available
- Manifest includes all metadata

**Implementation Details:**
- Use Helm packaging utilities
- Add comprehensive validation
- Integrate with signing services
- Create manifest generation

#### Task 4.3: Registry Management
**Requirements:**
- Configure multiple OCI registries
- Manage authentication credentials securely
- Test registry connectivity
- Browse published charts
- Manage chart versions and tags
- Support registry-specific features

**Acceptance Criteria:**
- Multiple registries can be configured
- Credentials are stored securely
- Connectivity tests work reliably
- Chart browsing is intuitive
- Version management is comprehensive
- Registry features are accessible

**Implementation Details:**
- Extend existing credential management
- Add registry configuration interface
- Create chart browsing components
- Integrate with registry APIs

### Epic 5: Testing & Documentation

#### Task 5.1: Comprehensive Testing
**Requirements:**
- Unit tests for all new components
- Integration tests for complete workflows
- E2E tests for user scenarios
- Performance tests for large charts
- Security tests for credential handling
- Compatibility tests across platforms

**Acceptance Criteria:**
- 90%+ code coverage for new features
- All critical workflows have E2E tests
- Performance benchmarks are met
- Security vulnerabilities are addressed
- Cross-platform compatibility is verified

**Implementation Details:**
- Use existing testing frameworks
- Add Helm-specific test utilities
- Create performance benchmarks
- Integrate security scanning

#### Task 5.2: User Documentation
**Requirements:**
- Complete user guide for new workflow
- Video tutorials for key scenarios
- API documentation for developers
- Troubleshooting guide
- Best practices documentation
- Migration guide from v1.0

**Acceptance Criteria:**
- Documentation covers all user scenarios
- Tutorials are clear and actionable
- API docs are comprehensive
- Troubleshooting covers common issues
- Best practices are well-defined
- Migration path is clear

**Implementation Details:**
- Create comprehensive documentation
- Record tutorial videos
- Generate API documentation
- Compile troubleshooting knowledge

## Success Criteria

### Technical Success
- All tasks completed with 90%+ test coverage
- Performance meets or exceeds v1.0 benchmarks
- Security review passes with no critical issues
- Cross-platform compatibility verified

### User Experience Success
- 80% reduction in modal interactions
- 50% faster chart generation workflow
- 95% user satisfaction in beta testing
- Zero critical usability issues

### Business Success
- 70% user adoption within 60 days
- 90% of generated charts deploy successfully
- 85% reduction in support tickets
- Positive feedback from key stakeholders

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-3)
- Epic 1: Folder Structure & Resource Management
- Basic file upload/delete functionality
- Resource metadata extraction

### Phase 2: Core Generation (Weeks 4-6)
- Epic 2: Helm Chart Generation Engine
- Direct chart generation
- Resource selection interface

### Phase 3: IDE Integration (Weeks 7-9)
- Epic 3: IDE Integration
- Enhanced editor support
- Git integration improvements

### Phase 4: Publishing (Weeks 10-12)
- Epic 4: Package & Publish
- OCI publishing modal
- Registry management

### Phase 5: Polish (Weeks 13-14)
- Epic 5: Testing & Documentation
- Comprehensive testing
- User documentation

## Risk Mitigation

### Technical Risks
- **File System Performance**: Implement efficient file watching and caching
- **YAML Parsing Complexity**: Use robust parsing libraries with error handling
- **Git Integration Issues**: Extensive testing with different Git providers

### User Experience Risks
- **Workflow Confusion**: Comprehensive user testing and documentation
- **Feature Discovery**: Clear UI indicators and onboarding flow
- **Migration Complexity**: Automated migration tools and clear guides

### Business Risks
- **Adoption Resistance**: Gradual rollout with opt-in beta period
- **Performance Regression**: Continuous performance monitoring
- **Support Overhead**: Proactive documentation and self-service tools

---

**Document Version**: 2.0  
**Last Updated**: [Current Date]  
**Next Review**: [Date + 30 days]  
**Owner**: Product Team  
**Stakeholders**: Engineering, DevOps, Product Management

**Previous Version**: creating-helm-charts.prd.md (v1.0)