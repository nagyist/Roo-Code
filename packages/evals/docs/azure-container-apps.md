# Azure Container Apps Integration

This document describes how to use Azure Container Apps as an execution method for Roo Code evals instead of Docker.

## Overview

Azure Container Apps provides a serverless container platform that can be used to run evals tasks in the cloud. This integration allows you to:

- Scale task execution automatically based on demand
- Reduce infrastructure management overhead
- Leverage Azure's global infrastructure
- Integrate with Azure monitoring and logging services

## Prerequisites

1. **Azure Subscription**: You need an active Azure subscription
2. **Azure CLI**: Install and configure the Azure CLI
3. **Container Registry**: Set up an Azure Container Registry or use another registry
4. **Database and Redis**: Ensure your PostgreSQL and Redis instances are accessible from Azure

## Setup

### 1. Deploy Azure Infrastructure

Use the provided Bicep templates to deploy the required Azure resources:

```bash
cd packages/evals/azure
./deploy.sh
```

This will create:

- Container App Environment
- Log Analytics Workspace
- Secrets for database connections and API keys

### 2. Build and Push Container Image

Build the evals runner image and push it to your container registry:

```bash
# Build the image
pnpm azure:build-image

# Tag and push to Azure Container Registry
export AZURE_CONTAINER_REGISTRY_SERVER="your-registry.azurecr.io"
pnpm azure:push-image
```

### 3. Configure Environment Variables

Copy the Azure environment template and fill in your values:

```bash
cp packages/evals/.env.azure packages/evals/.env.azure.local
```

Edit `.env.azure.local` with your actual Azure configuration:

```bash
# Azure Authentication
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Azure Container Apps Configuration
AZURE_RESOURCE_GROUP_NAME=roo-code-evals
AZURE_CONTAINER_APP_ENVIRONMENT_NAME=evals-env
AZURE_CONTAINER_APP_NAME=evals-runner
AZURE_LOCATION=eastus

# Container Registry Configuration
AZURE_CONTAINER_REGISTRY_SERVER=your-registry.azurecr.io
AZURE_CONTAINER_IMAGE=your-registry.azurecr.io/evals-runner:latest

# Execution Method
HOST_EXECUTION_METHOD=azure-container-apps

# Database and Redis (should point to Azure-hosted instances)
DATABASE_URL=postgres://username:password@hostname:5432/database
REDIS_URL=redis://hostname:6379

# API Keys
OPENROUTER_API_KEY=your-openrouter-api-key
```

## Usage

### Running with Azure Container Apps

Once configured, you can run evals using Azure Container Apps:

```bash
# Run CLI with Azure configuration
pnpm cli:azure

# Or set the environment variable directly
export HOST_EXECUTION_METHOD=azure-container-apps
pnpm cli
```

### Switching Between Execution Methods

You can easily switch between Docker and Azure Container Apps execution:

```bash
# Use Docker (default)
export HOST_EXECUTION_METHOD=docker
pnpm cli

# Use Azure Container Apps
export HOST_EXECUTION_METHOD=azure-container-apps
pnpm cli:azure
```

## Architecture

### Execution Flow

1. **Task Submission**: When a task is submitted, the system checks the `HOST_EXECUTION_METHOD` environment variable
2. **Job Creation**: For Azure Container Apps, a new Container Apps Job is created with the task parameters
3. **Container Execution**: Azure Container Apps runs the container with the specified command and environment variables
4. **Monitoring**: The system monitors the job execution status until completion
5. **Cleanup**: Completed job executions are cleaned up automatically

### Container Apps Jobs

Each task execution creates a new Container Apps Job with:

- **Image**: The evals-runner container image
- **Command**: `pnpm --filter @roo-code/evals cli --taskId {taskId}`
- **Environment Variables**: Database URL, Redis URL, API keys, etc.
- **Resources**: 1 CPU, 2Gi memory (configurable)
- **Retry Policy**: Configurable retry limit (default: 10)

### Networking and Security

- Container Apps run in a managed environment with built-in security
- Secrets are stored securely in the Container App Environment
- Network access is controlled through Azure networking features
- All communication uses HTTPS/TLS encryption

## Monitoring and Logging

### Azure Monitor Integration

The deployment includes Log Analytics Workspace integration for:

- Container logs and metrics
- Job execution status and duration
- Resource utilization monitoring
- Custom alerts and dashboards

### Accessing Logs

You can view logs through:

- Azure Portal (Container Apps > Logs)
- Azure CLI: `az containerapp logs show`
- Log Analytics queries
- Azure Monitor dashboards

## Cost Optimization

### Scaling Configuration

Container Apps automatically scale based on demand:

- **Min Replicas**: 0 (no cost when idle)
- **Max Replicas**: 10 (configurable)
- **Scale Rules**: Based on job queue length

### Resource Allocation

Default resource allocation per task:

- **CPU**: 1.0 cores
- **Memory**: 2Gi
- **Timeout**: 30 minutes

These can be adjusted based on your workload requirements.

## Troubleshooting

### Common Issues

1. **Authentication Errors**

    - Ensure Azure credentials are properly configured
    - Check service principal permissions
    - Verify subscription access

2. **Container Registry Access**

    - Confirm registry credentials are correct
    - Check network connectivity to registry
    - Verify image exists and is accessible

3. **Job Execution Failures**

    - Check container logs in Azure Portal
    - Verify environment variables are set correctly
    - Ensure database and Redis are accessible

4. **Network Connectivity**
    - Verify database and Redis endpoints are reachable
    - Check firewall rules and network security groups
    - Confirm DNS resolution

### Debugging Commands

```bash
# Check Azure login status
az account show

# List Container Apps
az containerapp list --resource-group roo-code-evals

# View job executions
az containerapp job execution list --name evals-runner --resource-group roo-code-evals

# Get job logs
az containerapp job logs show --name evals-runner --resource-group roo-code-evals
```

## Migration from Docker

To migrate from Docker to Azure Container Apps:

1. **Deploy Azure Infrastructure**: Use the provided deployment script
2. **Update Configuration**: Set `HOST_EXECUTION_METHOD=azure-container-apps`
3. **Test Execution**: Run a few test tasks to verify functionality
4. **Monitor Performance**: Check logs and metrics to ensure proper operation
5. **Scale Gradually**: Gradually increase the workload on Azure Container Apps

## Security Considerations

- **Secrets Management**: All sensitive data is stored in Azure Key Vault or Container App secrets
- **Network Isolation**: Container Apps run in a managed virtual network
- **Access Control**: Use Azure RBAC to control access to resources
- **Compliance**: Azure Container Apps supports various compliance standards
- **Encryption**: Data is encrypted in transit and at rest

## Performance Tuning

### Resource Optimization

- Monitor CPU and memory usage to right-size containers
- Adjust timeout values based on task complexity
- Configure appropriate retry policies

### Scaling Configuration

- Set appropriate min/max replica counts
- Configure scale rules based on queue depth
- Monitor scaling metrics and adjust as needed

## Support and Maintenance

### Regular Maintenance

- Keep container images updated with security patches
- Monitor Azure service health and updates
- Review and optimize resource allocation
- Update Azure CLI and tools regularly

### Getting Help

- Check Azure Container Apps documentation
- Review Azure status page for service issues
- Contact Azure support for platform-specific issues
- Use the project's issue tracker for integration problems
