Deploying **harbor**, **Gitea**, **ArgoCD**, **Tekton**, **Vault**, and **Vault + External Secrets Operator** on a local Kubernetes cluster running inside **WSL2** is very doable — and you've already got the right mental model to orchestrate a full GitOps toolchain.

Below is a step-by-step plan that walks you through the process. We'll focus on **lightweight, local-friendly deployments**, assuming you're using:

* **WSL2 Ubuntu**
* A local K8s distribution like `k3s`, `minikube`, or `kind` (I’ll assume `k3s` for simplicity, but can adapt if you're using something else)
* Helm for installing components

---

## ✅ 1. \[Prepare Local Environment]

### Install Basics in WSL2:

```bash
sudo apt update && sudo apt install -y curl unzip git
curl -LO https://get.helm.sh/helm-v3.14.3-linux-amd64.tar.gz
tar -zxvf helm-*-linux-amd64.tar.gz
sudo mv linux-amd64/helm /usr/local/bin/helm
```

### (Optional) Start Local K3s:

```bash
curl -sfL https://get.k3s.io | sh -
# Or use minikube / kind if preferred
```

Check:

```bash
kubectl get nodes
```

---

## ✅ 2. \[Add Helm Repos]

```bash
helm repo add harbor https://helm.goharbor.io
helm repo add gitea-charts https://dl.gitea.io/charts/
helm repo add argo https://argoproj.github.io/argo-helm
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
```

---

## ✅ 3. \[Install harbor]

```bash
helm install harbor harbor/harbor \
  --namespace harbor --create-namespace \
  --set expose.type=NodePort \
  --set expose.tls.enabled=false \
  --set harborAdminPassword=Harbor12345
```

💡 We'll be able to push charts locally at `http://localhost:<NodePort>`
   Login: admin / Harbor12345

---

## ✅ 4. \[Install Gitea (Git Server)]

```bash
helm install gitea gitea-charts/gitea \
  --namespace gitea --create-namespace \
  --set gitea.admin.username=gitadmin \
  --set gitea.admin.password=gitadmin \
  --set service.http.type=NodePort
```

You can forward the Gitea service port to your local machine like this:

```bash
kubectl port-forward svc/gitea-http -n gitea 9080:3000
```

Now access Gitea in your browser:

```plaintext
http://localhost:9080
```

📂 Gitea will be accessible at `http://localhost:<NodePort>`
(Default user: `gitadmin` / `gitadmin`)

---

## ✅ 5. \[Install ArgoCD]

```bash
helm install argocd argo/argo-cd \
  --namespace argocd --create-namespace \
  --set server.service.type=NodePort
```

🗝️ To get initial admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

which output to something like `lscOC-R2EPh0fgr0`

🌐 Open UI at `http://localhost:<NodePort>`
(Default user: `admin`)

---

## ✅ 6. \[Install Tekton Pipelines + Dashboard]

```bash
kubectl apply --filename https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml
kubectl apply --filename https://storage.googleapis.com/tekton-releases/dashboard/latest/tekton-dashboard-release.yaml
```

💡 Optionally expose the dashboard via:

```bash
kubectl port-forward svc/tekton-dashboard -n tekton-pipelines 9097:9097
```

---

## ✅ 7. \[Install HashiCorp Vault (Dev Mode)]

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault --create-namespace \
  --set "server.dev.enabled=true" \
  --set "ui.enabled=true" \
  --set "service.type=NodePort"
```

💡 UI: `http://localhost:<NodePort>`
🛠 Dev mode token is usually `root`

---

## ✅ 8. \[Install External Secrets Operator + Vault Provider]

```bash
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets --create-namespace
```

Then apply a secret store:

```yaml
# vault-secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: default
spec:
  provider:
    vault:
      server: "http://vault.vault.svc.cluster.local:8200"
      path: "secret"
      version: "v2"
      auth:
        tokenSecretRef:
          name: vault-token
          key: token
```

Apply with:

```bash
kubectl apply -f vault-secret-store.yaml
```

---

## ✅ 9. \[Access Services via NodePort or Port Forwarding]

If you're using `k3s` or `minikube`:

```bash
kubectl get svc -A | grep NodePort
```

Or port-forward individually:

```bash
kubectl port-forward svc/chartmuseum 8080:80 -n chartmuseum
kubectl port-forward svc/gitea-http 3000:3000 -n gitea
kubectl port-forward svc/argocd-server 8082:80 -n argocd
```

---

# Retrieving ArgoCD Admin Password/Token

If you've forgotten the ArgoCD admin access token or password, you can retrieve it using `kubectl`. Here's how:

## For the initial admin password (most common case):

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

## If you're using a different authentication method:

1. **List all secrets in argocd namespace** to find the relevant one:
```bash
kubectl -n argocd get secrets
```

2. **For API tokens** created for accounts:
```bash
kubectl -n argocd get secret argocd-secret -o jsonpath="{.data}" | jq
```

## Alternative methods:

1. **Port-forward and use CLI**:
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
argocd admin initial-password -n argocd
```

2. **If you have CLI access**, you can generate a new token:
```bash
argocd account generate-token --account <username>
```

Remember that by default, the initial password is autogenerated and stored in the `argocd-initial-admin-secret` Secret, which is created during Argo CD installation.

## Vault related stuff
To access the **Vault API** in your local Kubernetes (WSL2) setup, follow these steps:

---

### **1. Access the API Endpoint**
#### **Method A: Port-Forwarding (Recommended for Local Dev)**
```bash
# Forward Vault's API port (8200) to your local machine
kubectl port-forward -n vault svc/vault 9201:8201 &
```
Now the API is available at:  
🔗 **`http://localhost:9201/v1/`**

#### **Method B: Direct NodePort Access (If Configured)**
If you exposed Vault via `NodePort` (e.g., port `32000`):
```bash
kubectl get svc -n vault  # Look for the NodePort (e.g., 32000)
```
Access the API at:  
🔗 **`http://localhost:<NodePort>/v1/`**  
*(Replace `<NodePort>` with the actual port, e.g., `32000`)*

---

### **2. Authenticate to the API**
#### **For Dev Mode (Root Token)**
1. Get the root token from the logs:
   ```bash
   kubectl logs -n vault vault-0 | grep "Root Token"
   ```
   Output:
   ```
   Root Token: s.xxxxxxxxxxxxxxxx
   ```
2. Use the token in API requests:
   ```bash
   curl -H "X-Vault-Token: s.xxxxxxxxxxxxxxxx" http://localhost:9201/v1/secret/data/myapp/config
   ```

#### **For Production (Auth Methods)**
1. **Kubernetes Auth** (Recommended for K8s workloads):
   ```bash
   # Authenticate using a Kubernetes ServiceAccount token
   curl --request POST \
     --data '{"jwt": "'$(kubectl get secret -n external-secrets external-secrets-vault-auth -o jsonpath="{.data.token}" | base64 --decode)'", "role": "external-secrets"}' \
     http://localhost:9201/v1/auth/kubernetes/login
   ```
   Returns a **client token** for subsequent requests.

2. **Token Auth** (Static Tokens):
   ```bash
   curl -H "X-Vault-Token: YOUR_TOKEN" http://localhost:9201/v1/secret/data/myapp/config
   ```

---

### **3. Common API Examples**
#### **Read a Secret**
```bash
curl -H "X-Vault-Token: s.xxxxxxxxxxxxxxxx" \
  http://localhost:9201/v1/secret/data/myapp/config
```

#### **Write a Secret**
```bash
curl -H "X-Vault-Token: s.xxxxxxxxxxxxxxxx" -X POST \
  -d '{"data": {"password": "new-s3cr3t"}}' \
  http://localhost:9201/v1/secret/data/myapp/config
```

#### **List Secrets**
```bash
curl -H "X-Vault-Token: s.xxxxxxxxxxxxxxxx" \
  http://localhost:9201/v1/secret/metadata/myapp?list=true
```

---

### **4. Troubleshooting**
#### **"Connection Refused"**
- Ensure port-forward is running (`kubectl port-forward`).  
- Check Vault pod status:
  ```bash
  kubectl get pods -n vault
  ```

#### **"Permission Denied"**
- Verify your token is valid:
  ```bash
  kubectl exec -n vault vault-0 -- vault token lookup
  ```

#### **WSL2 to Windows Access**
- If accessing from Windows, use `localhost:9201` (WSL2 forwards ports automatically).  
- If using `NodePort`, ensure Windows firewall allows the port (e.g., `32000`).

---

### **Key Notes**
1. **Dev Mode**: Your current setup uses **insecure defaults** (no TLS, root token).  
   For production:  
   - Enable TLS in Helm values (`server.tls.enabled=true`).  
   - Use auth methods like OIDC/Kubernetes.  

2. **API vs UI**:  
   - API: `http://localhost:9201/v1/`  
   - UI: `http://localhost:9200/ui`  

3. **External Secrets Operator (ESO)**:  
   Configure ESO to use the API endpoint:  
   ```yaml
   # SecretStore spec
   provider:
     vault:
       server: "http://vault.vault.svc.cluster.local:8200"
   ```

---

### **Next Steps**
- **Secure Your API**:  
  ```bash
  helm upgrade vault hashicorp/vault -n vault --set server.dev.enabled=false --set server.tls.enabled=true
  ```
- **Explore API Docs**:  
  🔗 [Vault HTTP API Documentation](https://developer.hashicorp.com/vault/api-docs)  
