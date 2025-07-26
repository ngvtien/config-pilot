#!/bin/bash
# Kill existing port-forwards
pkill -f "port-forward.*gitea"

# Start new port-forwards in background
# kubectl port-forward svc/gitea-http -n gitea 9080:3000 &
# kubectl port-forward svc/gitea-ssh -n gitea 2222:22 &

kubectl port-forward svc/gitea-http -n gitea --address 0.0.0.0 9080:3000 &
kubectl port-forward svc/gitea-ssh -n gitea --address 0.0.0.0 2222:22 &


echo "Gitea is now available at:"
echo "- Web: http://localhost:9080"
echo "- SSH: ssh -p 2222 git@localhost"