#!/bin/bash

# Azure Container Apps Deployment Script for Roo Code Evals
# This script deploys the Azure infrastructure needed for Azure Container Apps execution

set -e

# Configuration
RESOURCE_GROUP_NAME="${AZURE_RESOURCE_GROUP_NAME:-roo-code-evals}"
LOCATION="${AZURE_LOCATION:-eastus}"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}"

# Validate required environment variables
if [ -z "$SUBSCRIPTION_ID" ]; then
    echo "Error: AZURE_SUBSCRIPTION_ID environment variable is required"
    exit 1
fi

echo "🚀 Starting Azure Container Apps deployment..."
echo "📍 Resource Group: $RESOURCE_GROUP_NAME"
echo "🌍 Location: $LOCATION"
echo "🔑 Subscription: $SUBSCRIPTION_ID"

# Login to Azure (if not already logged in)
echo "🔐 Checking Azure login status..."
if ! az account show &>/dev/null; then
    echo "Please log in to Azure:"
    az login
fi

# Set the subscription
echo "📋 Setting Azure subscription..."
az account set --subscription "$SUBSCRIPTION_ID"

# Create resource group if it doesn't exist
echo "📦 Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP_NAME" \
    --location "$LOCATION" \
    --output table

# Deploy the Bicep template
echo "🏗️ Deploying Azure Container Apps infrastructure..."
az deployment group create \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --template-file main.bicep \
    --parameters main.bicepparam \
    --output table

# Get deployment outputs
echo "📤 Retrieving deployment outputs..."
CONTAINER_APP_ENV_ID=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --name main \
    --query 'properties.outputs.containerAppEnvironmentId.value' \
    --output tsv)

CONTAINER_APP_ENV_NAME=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --name main \
    --query 'properties.outputs.containerAppEnvironmentName.value' \
    --output tsv)

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "   Resource Group: $RESOURCE_GROUP_NAME"
echo "   Container App Environment: $CONTAINER_APP_ENV_NAME"
echo "   Container App Environment ID: $CONTAINER_APP_ENV_ID"
echo ""
echo "🔧 To use Azure Container Apps execution, set these environment variables:"
echo "   export AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
echo "   export AZURE_RESOURCE_GROUP_NAME=$RESOURCE_GROUP_NAME"
echo "   export AZURE_CONTAINER_APP_ENVIRONMENT_NAME=$CONTAINER_APP_ENV_NAME"
echo "   export HOST_EXECUTION_METHOD=azure-container-apps"
echo ""
echo "📚 For more information, see the Azure Container Apps documentation."