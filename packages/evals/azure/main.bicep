@description('The name of the Container App Environment')
param containerAppEnvironmentName string = 'evals-env'

@description('The name of the Container App')
param containerAppName string = 'evals-runner'

@description('The location for all resources')
param location string = resourceGroup().location

@description('The container registry server')
param containerRegistryServer string

@description('The container image')
param containerImage string

@description('The container registry username')
@secure()
param containerRegistryUsername string

@description('The container registry password')
@secure()
param containerRegistryPassword string

@description('The database connection string')
@secure()
param databaseUrl string

@description('The Redis connection string')
@secure()
param redisUrl string

@description('The OpenRouter API key')
@secure()
param openRouterApiKey string

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${containerAppEnvironmentName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Container App Environment
resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

// Container Registry Secret
resource containerRegistrySecret 'Microsoft.App/managedEnvironments/secrets@2023-05-01' = {
  parent: containerAppEnvironment
  name: 'container-registry-password'
  properties: {
    value: containerRegistryPassword
  }
}

// Database URL Secret
resource databaseUrlSecret 'Microsoft.App/managedEnvironments/secrets@2023-05-01' = {
  parent: containerAppEnvironment
  name: 'database-url'
  properties: {
    value: databaseUrl
  }
}

// Redis URL Secret
resource redisUrlSecret 'Microsoft.App/managedEnvironments/secrets@2023-05-01' = {
  parent: containerAppEnvironment
  name: 'redis-url'
  properties: {
    value: redisUrl
  }
}

// OpenRouter API Key Secret
resource openRouterApiKeySecret 'Microsoft.App/managedEnvironments/secrets@2023-05-01' = {
  parent: containerAppEnvironment
  name: 'openrouter-api-key'
  properties: {
    value: openRouterApiKey
  }
}

// Container App for Jobs (this will be used as a template for job executions)
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      secrets: [
        {
          name: 'container-registry-password'
          value: containerRegistryPassword
        }
        {
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'redis-url'
          value: redisUrl
        }
        {
          name: 'openrouter-api-key'
          value: openRouterApiKey
        }
      ]
      registries: [
        {
          server: containerRegistryServer
          username: containerRegistryUsername
          passwordSecretRef: 'container-registry-password'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'evals-runner'
          image: containerImage
          env: [
            {
              name: 'HOST_EXECUTION_METHOD'
              value: 'azure-container-apps'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'OPENROUTER_API_KEY'
              secretRef: 'openrouter-api-key'
            }
          ]
          resources: {
            cpu: 1
            memory: '2Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
      }
    }
  }
}

// Output values
output containerAppEnvironmentId string = containerAppEnvironment.id
output containerAppEnvironmentName string = containerAppEnvironment.name
output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id