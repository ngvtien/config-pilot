# Kubernetes Proxy Configuration for WSL-Windows Connectivity

## Problem Statement

When developing an Electron application on Windows that needs to connect to a Kubernetes cluster running in WSL2 (Windows Subsystem for Linux), direct connectivity issues arise due to network isolation between Windows and WSL2.

### Specific Issues Encountered

1. **Network Connectivity**: WSL2 uses a virtualized network adapter with dynamic IP addresses that are not directly accessible from Windows
2. **Authentication Errors**: The Electron app was authenticating as `system:anonymous` instead of using proper credentials
3. **403 Forbidden Errors**: CRD discovery failed with permission errors due to authentication issues
4. **TLS/Certificate Issues**: Direct connection attempts resulted in certificate validation problems

### Error Examples

ApiException [Error]: HTTP-Code: 403
Message: customresourcedefinitions.apiextensions.k8s.io is forbidden:
User "system:anonymous" cannot list resource "customresourcedefinitions"
in API group "apiextensions.k8s.io" at the cluster scope

HTTP protocol is not allowed when skipTLSVerify is not set or false


## Solution: kubectl proxy

The solution involves using `kubectl proxy` to create a bridge between the Windows Electron app and the WSL-based Kubernetes cluster.

### Architecture

### Implementation Steps

#### 1. Start kubectl proxy in WSL

```bash
# In WSL terminal
kubectl proxy --port=8080 --accept-hosts='.*' --address='0.0.0.0'
```

This creates an HTTP proxy server that:

- Runs on port 8080
- Accepts connections from any host
- Handles authentication automatically
- Provides an HTTP interface to the Kubernetes API 2. Create Proxy Kubeconfig for Windows

### 2. Create Proxy Kubeconfig for Windows
Create a new kubeconfig file on Windows at C:\Users\{username}\.kube\config-proxy :

```yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: http://localhost:8080
    insecure-skip-tls-verify: true
  name: kind-simplekubeapp-proxy
contexts:
- context:
    cluster: kind-simplekubeapp-proxy
    user: kind-simplekubeapp
  name: kind-simplekubeapp-proxy
current-context: kind-simplekubeapp-proxy
users:
- name: kind-simplekubeapp
  user: {}
```

## Key Configuration Points:

- server: http://localhost:8080 - Points to the proxy endpoint
- insecure-skip-tls-verify: true - Required for HTTP connections
- Empty user credentials - Authentication handled by proxy 3. Update Electron App Configuration
### Update the Electron app to use the proxy kubeconfig:

1. Option A: Update App Settings
   
   - Navigate to kubeconfig settings in the Electron app
   - Change path to: C:\Users\{username}\.kube\config-proxy
2. Option B: Temporary Code Override

```typescript
// In src/main/ipc-handlers.ts
const proxyConfigPath = 'C:\\Users\\{username}\\.kube\\config-proxy';
await schemaService.initializeCRDs(proxyConfigPath);
```

## Results
After implementing the proxy solution:

✅ Successful CRD Discovery

- Connected to cluster via http://localhost:8080
- Discovered 3 CRDs successfully:
  - argoproj.io/v1alpha1/Application
  - argoproj.io/v1alpha1/ApplicationSet
  - argoproj.io/v1alpha1/AppProject
✅ Authentication Working

- No more system:anonymous errors
- Proper credential handling via proxy
✅ Network Connectivity Resolved

- Windows app can reliably connect to WSL cluster
- No more connection refused errors
## Troubleshooting
### Common Issues
1. "HTTP protocol is not allowed" Error
   
   - Ensure insecure-skip-tls-verify: true is set in the cluster configuration
   - Verify the server URL uses http:// not https://
2. Connection Refused
   
   - Check that kubectl proxy is running in WSL
   - Verify the proxy is listening on the correct port
   - Ensure Windows firewall isn't blocking the connection
3. Authentication Errors
   
   - Verify the original WSL kubeconfig has proper credentials
   - Check that kubectl works directly in WSL before starting proxy

## Verification Commands   

```bash
# Test proxy connectivity from Windows
curl http://localhost:8080/api/v1/namespaces

# Test kubectl with proxy config
kubectl --kubeconfig="C:\Users\{username}\.kube\config-proxy" get nodes

# Verify proxy is running in WSL
ps aux | grep "kubectl proxy"
```

## Development Workflow
1. Start Development Session
```bash
# In WSL terminal
kubectl proxy --port=8080 --accept-hosts='.*' --address='0.0.0.0'
```

1. Run Electron App
   
   - Ensure app is configured to use proxy kubeconfig
   - Start the application normally
2. Stop Development Session
   
   - Stop the Electron app
   - Terminate the kubectl proxy (Ctrl+C in WSL terminal)
## Alternative Solutions Considered
1. Direct WSL IP Connection : Unreliable due to dynamic IP changes
2. Windows Port Forwarding : Complex setup and maintenance
3. Docker Desktop Integration : Would require changing the entire cluster setup
4. VPN/Network Bridge : Overkill for development purposes

---

## Conclusion
The kubectl proxy solution provides a reliable, simple, and maintainable way to bridge the network gap between Windows-based Electron applications and WSL2-hosted Kubernetes clusters. It handles authentication automatically and provides a stable HTTP endpoint that works consistently across development sessions.

```plaintext

This documentation file has been created in the root folder and covers:
- The complete problem analysis
- Step-by-step solution implementation
- Configuration examples
- Troubleshooting guide
- Development workflow recommendations
- Results and verification steps

You can now reference this file for future development or share it with team members who might encounter similar issues.
```

