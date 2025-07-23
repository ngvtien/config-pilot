### Product Gitops relationship
- 1:1 Product : repo
- 1:1 environment : repo-branch
- 1:1 appset.yaml : envrionment
- 1:1 customers.yaml : envrionment

### Understanding of the current Product concept
Currently the concept of Product is not really clear, it should be instead **Product Component** and there is obviously there is a 1:m Product: Product Component.
eg. a product `cai` can have the following components `cai-infra`, `cai-database`, `cai-frontend`, `cai-backend`, `cai-extract-01-job`, `cai-webapi`, `cai-soap-svc`, etc, etc

### So what the purpose of a `Product`?
#### Product unify the following:
1. namespace (so it can reuse between components)
2. Secret path (so it can reuse between components)

#### When it comes to the relationship with git it should be based on Product Componnent **NOT** Product
#### What link between Product and Product Component?
- each Product component should have a reference property say `"Parent"` which point back to the name of the product

### Discussions
How to manage switching between repositories and repository branches effectively without incurred performance

### Relationship with other types

1:1 between product : project (which get compose via project composer)
1:n project: product components
1:1 product components: template 
