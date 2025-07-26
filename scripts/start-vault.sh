#!/bin/bash
# Kill existing port-forwards
pkill -f "port-forward.*vault"

# Start new port-forwards in background
# kubectl port-forward svc/gitea-http -n gitea 9080:3000 &
# kubectl port-forward svc/gitea-ssh -n gitea 2222:22 &

# For Vault UI:
kubectl port-forward svc/vault-ui -n vault --address 0.0.0.0 9200:8200 &

# For Vault API:
kubectl port-forward svc/vault -n vault --address 0.0.0.0 9201:8200 &


echo "Vault is now available at:"
echo "- Web: http://localhost:9200"
echo "- API: http://localhost:9201"