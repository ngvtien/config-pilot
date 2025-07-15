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

## 🧩 Optional

If you'd like, I can prepare:

* A Git repo with a `deploy-all.sh` script
* Or PowerShell `deploy-all.ps1` for WSL
* Or a Kustomize or Helm umbrella chart with all components wired together

