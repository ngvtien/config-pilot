#!/bin/bash
# Gitea RBAC with Product/Environment/Customer Structure

# ========================
# 1. CONFIGURATION
# ========================
GITEA_URL="curl http://172.18.0.2:30581"
ADMIN_USER="gitadmin"
ADMIN_TOKEN="358fa0d502c54ea7a45873b2b76046a9f676550a"  # Obtain via Method 1/2 from previous answer

# Products and Environments
PRODUCTS=("cai" "esb", "b2b", "npp", "payto", "cop")  # Add your products
ENVIRONMENTS=("dev" "sit" "uat" "prod")
CUSTOMERS=("bba" "acf" "mecu", "subnac", "pccu", "bhcu", "dfcu")  # Customer IDs

# Teams and Permissions
declare -A TEAM_PERMISSIONS=(
  ["dev-team"]="write"
  ["support-team"]="write"
  ["platform-team"]="admin"
)

declare -A ENV_TEAMS=(
  ["dev"]="dev-team,platform-team"
  ["sit"]="support-team,platform-team"
  ["uat"]="support-team,platform-team"
  ["prod"]="platform-team"  # Only platform can merge to prod
)

# Users
declare -A TEAM_MEMBERS=(
  ["dev-team"]="dev1,dev2"
  ["support-team"]="support1,support2"
  ["platform-team"]="platform1,platform2"
  ["test-team"]="test1,test2"  # For testing role switching
)

# ========================
# 2. HELPER FUNCTIONS
# ========================
init_repo_structure() {
  local repo=$1
  git clone http://$ADMIN_USER:$ADMIN_TOKEN@localhost:9080/gitadmin/$repo.git
  cd $repo
  for env in "${ENVIRONMENTS[@]}"; do
    git checkout -b $env
    mkdir -p $env
    # Create customer directories
    for customer in "${CUSTOMERS[@]}"; do
      mkdir -p "$env/$customer"
      touch "$env/$customer/values.yaml"
    done
    # Create common files
    touch "$env/customers.yaml" "$env/applicationset.yaml"
    git add . && git commit -m "Initialize $env environment"
    git push origin $env
  done
  cd ..
}

set_branch_protection() {
  local repo=$1 env=$2
  IFS=',' read -ra TEAMS <<< "${ENV_TEAMS[$env]}"
  TEAMS_JSON=$(printf '"%s"\n' "${TEAMS[@]}" | jq -s .)
  
  curl -X POST "$GITEA_URL/api/v1/repos/gitadmin/$repo/branch_protections" \
    -H "Authorization: token $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "branch_name": "'"$env"'",
      "enable_push": true,
      "push_whitelist_teams": '"$TEAMS_JSON"',
      "required_approvals": '"$( [[ $env == "prod" ]] && echo 2 || echo 1 )"'
    }'
}

# ========================
# 3. MAIN SETUP
# ========================

# Create Teams and Users
for team in "${!TEAM_PERMISSIONS[@]}"; do
  curl -X POST "$GITEA_URL/api/v1/admin/teams" \
    -H "Authorization: token $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "'"$team"'",
      "permission": "'"${TEAM_PERMISSIONS[$team]}"'",
      "units": ["repo.code","repo.issues","repo.pulls","repo.releases"]
    }'
  
  # Add team members
  IFS=',' read -ra MEMBERS <<< "${TEAM_MEMBERS[$team]}"
  for user in "${MEMBERS[@]}"; do
    curl -X POST "$GITEA_URL/api/v1/admin/users" \
      -H "Authorization: token $ADMIN_TOKEN" \
      -d '{"username": "'"$user"'", "email": "'"$user"'@example.com", "password": "password"}'
    
    curl -X PUT "$GITEA_URL/api/v1/teams/$(curl -s "$GITEA_URL/api/v1/teams?q=$team" -H "Authorization: token $ADMIN_TOKEN" | jq -r '.[0].id')/members/$user" \
      -H "Authorization: token $ADMIN_TOKEN"
  done
done

# Create Repositories and Structure
for product in "${PRODUCTS[@]}"; do
  curl -X POST "$GITEA_URL/api/v1/user/repos" \
    -H "Authorization: token $ADMIN_TOKEN" \
    -d '{"name": "'"$product"'", "auto_init": false, "private": true}'
  
  init_repo_structure "$product"
  
  # Set branch protections
  for env in "${ENVIRONMENTS[@]}"; do
    set_branch_protection "$product" "$env"
  done
done

# ========================
# 4. VERIFICATION
# ========================
echo -e "\n\033[1;32mSETUP COMPLETE\033[0m"
echo -e "Folder structure per product:"
echo -e "  product/"
echo -e "    ├── dev/"
echo -e "    │   ├── customers.yaml"
echo -e "    │   ├── acme/values.yaml"
echo -e "    │   └── beta/values.yaml"
echo -e "    └── prod/"
echo -e "        ├── customers.yaml"
echo -e "        └── acme/values.yaml"

echo -e "\nAccess Control:"
for env in "${!ENV_TEAMS[@]}"; do
  echo "- $env: ${ENV_TEAMS[$env]}"
done