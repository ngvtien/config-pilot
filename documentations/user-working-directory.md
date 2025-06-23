
## Configuration

### Setting the Working Directory

1. Navigate to **Settings** → **General** tab
2. Locate the **Working Directory** field
3. Enter the absolute path to your desired working directory
4. Use the **Browse** button to select a folder using the file explorer
5. Click **Save** to apply the changes

### Default Location

If no working directory is specified, the application will use the user's default documents folder.

## Template Structure Details

### Root Template Files

#### template.metadata.json
Contains the complete template configuration including:
- Template name and description
- Selected Kubernetes resources
- Field configurations
- Creation and update timestamps
- Resource-specific metadata

```json
{
  "name": "my-application",
  "description": "A sample application template",
  "resources": [
    {
      "kind": "Deployment",
      "apiVersion": "apps/v1",
      "selectedFields": [...],
      "templateType": "kubernetes"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Folder Structure Created
When you save a template named "my-app", it will create:

```
{baseDirectory}/
└── my-app/
    ├── template.metadata.json     #   Template configuration and metadata
    ├── template.schema.json      #   JSON Schema for validation
    ├── helm/
    │   ├── Chart.yaml            #   Helm chart definition
    │   ├── values.yaml           #   Default values
    │   └── templates/
    │       ├── deployment.yaml   #    Individual resource templates
    │       ├── service.yaml
    │       └── configmap.yaml
    └── kustomize/
        ├── kustomization.yaml    #    Kustomize configuration
        ├── deployment.yaml       #    Individual resource manifests
        ├── service.yaml
        └── configmap.yaml
```
## Key Features
1. Simplified Structure : Removed the extra "templates" folder nesting as requested
2. Template Metadata : Saves complete template information to template.metadata.json
3. Schema Generation : Creates template.schema.json for validation
4. Multi-Format Support : Generates both Helm and Kustomize variants
5. Resource-Specific Files : Creates individual YAML files for each selected resource
6. Error Handling : Includes proper error handling and logging
The implementation uses the existing baseDirectory from settings and leverages the current template data structure. The Save Template button will now create the complete folder structure and generate all necessary files.

## template.schema.json

JSON Schema file for template validation, automatically generated based on selected resources and fields.

### Helm Directory Structure
The helm/ subdirectory contains a complete Helm chart:

- Chart.yaml : Helm chart metadata and version information
- values.yaml : Default configuration values for the chart
- templates/ : Directory containing individual Kubernetes resource templates
  - Each selected resource type gets its own YAML file
  - Files are named using the pattern: {resource-kind}.yaml
  - Templates include Helm templating syntax for dynamic values

### Kustomize Directory Structure
The kustomize/ subdirectory contains Kustomize configuration:

- kustomization.yaml : Main Kustomize configuration file
- {resource-kind}.yaml : Individual Kubernetes resource manifests
  - Static YAML files for each selected resource
  - Ready for Kustomize overlays and patches

## Template Creation Workflow
### Using the Template Designer
1. Template Information
   
   - Enter template name in the "Template Name" field
   - Optionally provide a description
2. Resource Selection
   
   - Search and select Kubernetes resource kinds
   - Configure specific fields for each resource
   - Preview the resource configuration
1. Save Template
   
   - Click the "Save Template" button
   - The system automatically creates the folder structure
   - All files are generated based on the template configuration

### Generated Files
When saving a template, the following files are automatically created:

1. Metadata Files
   
   - template.metadata.json : Complete template configuration
   - template.schema.json : Validation schema
2. Helm Files
   
   - helm/Chart.yaml : Chart definition
   - helm/values.yaml : Default values
   - helm/templates/{resource}.yaml : Resource templates

3. Kustomize Files
   
   - kustomize/kustomization.yaml : Kustomize configuration
   - kustomize/{resource}.yaml : Resource manifests   

## File Management
### Directory Creation
- Directories are created recursively if they don't exist
- Proper error handling for permission issues
- Automatic cleanup of empty directories

### File Operations
- JSON files are formatted with proper indentation
- YAML files follow Kubernetes conventions
- Existing files are overwritten when saving templates
- Backup functionality (planned feature)

### Error Handling
- Invalid directory paths are validated
- Permission errors are reported to the user
- File write failures are logged and displayed
- Rollback mechanism for partial failures

## Best Practices
### Directory Organization
- Use descriptive template names
- Avoid special characters in template names
- Group related templates in subdirectories if needed
- Maintain consistent naming conventions

### Template Management
- Regularly backup your working directory
- Use version control for template files
- Document template purposes and usage
- Test templates before deployment

### Security Considerations
- Ensure proper file permissions on the working directory
- Avoid storing sensitive data in template files
- Use secure paths that don't expose system information
- Regular security audits of template contents   

## Integration Points
### Settings Integration
- Working directory path is stored in application settings
- Changes take effect immediately
- Path validation ensures directory accessibility

### Template Designer Integration
- Automatic folder structure creation
- Real-time validation of template data
- Progress feedback during save operations
- Error reporting for failed operations

### File Explorer Integration
- Browse and select working directory
- Navigate to saved templates
- Open template files in external editors
- Import existing template structures

## Troubleshooting
### Common Issues
1. Permission Denied

   - Ensure the application has write permissions to the working directory
   - Check if the directory is read-only
   - Verify user account permissions

2. Invalid Path
   
   - Verify the directory path exists
   - Check for typos in the path
   - Ensure proper path format for your operating system

3. Disk Space
   
   - Ensure sufficient disk space for template files
   - Clean up old or unused templates
   - Monitor directory size growth

### Error Messages
- "Failed to create directory" : Check permissions and path validity
- "Template name is required" : Ensure template name is provided
- "Failed to save template" : Check disk space and permissions

## Future Enhancements
### Planned Features
- Template versioning and history
- Template sharing and import/export
- Advanced template validation
- Integration with Git repositories
- Template marketplace integration
- Automated backup and sync

### API Extensions
- REST API for template management
- CLI tools for template operations
- Integration with CI/CD pipelines
- Webhook support for template events