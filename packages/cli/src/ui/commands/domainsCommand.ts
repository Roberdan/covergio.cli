/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand } from './types.js';

/**
 * Domain exploration and capability management commands
 */
export const domainsCommand: SlashCommand = {
  name: 'domains',
  altName: 'domain',
  description: 'Explore available domains and their capabilities',
  subCommands: [
    {
      name: 'list',
      altName: 'ls',
      description: 'List all available domains',
      action: async (context) => {
        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const domains = await orchestrator.getAvailableDomains();
          
          if (domains.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: 'No domains currently available. Check your agent configuration.'
            };
          }

          const domainList = domains.map((domain: any) => {
            const agentCount = domain.agents?.length || 0;
            const capabilities = domain.capabilities?.map((cap: any) => cap.name).join(', ') || 'No capabilities';
            
            return `📁 ${domain.name}
  Description: ${domain.description || 'No description'}
  Agents: ${agentCount}
  Capabilities: ${capabilities}
  Status: ${domain.status || 'unknown'}`;
          }).join('\n\n');

          return {
            type: 'message',
            messageType: 'info',
            content: `Available Domains (${domains.length}):\n\n${domainList}\n\nUse /domains show <domain-name> for detailed information.`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to list domains: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'show',
      description: 'Show detailed information about a specific domain',
      action: async (context, args) => {
        const domainName = args.trim();
        if (!domainName) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /domains show <domain-name>'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const domain = await orchestrator.getDomain(domainName);
          if (!domain) {
            return {
              type: 'message',
              messageType: 'error',
              content: `Domain '${domainName}' not found. Use /domains list to see available domains.`
            };
          }

          const capabilities = domain.capabilities?.map((cap: any) => 
            `  📋 ${cap.name} (v${cap.version})
     Description: ${cap.description || 'No description'}
     Operations: ${cap.supportedOperations?.join(', ') || 'None'}
     Tools: ${cap.requiredTools?.join(', ') || 'None'}
     Performance: ${cap.performance ? `${cap.performance.latency}ms latency, ${cap.performance.throughput} req/min` : 'N/A'}`
          ).join('\n\n') || 'No capabilities available';

          const agents = domain.agents?.map((agent: any) => 
            `  🤖 ${agent.id} [${agent.type}] - ${agent.status}`
          ).join('\n') || 'No agents available';

          const useCases = domain.useCases?.map((useCase: any) => 
            `  💡 ${useCase.name}: ${useCase.description}`
          ).join('\n') || 'No use cases documented';

          return {
            type: 'message',
            messageType: 'info',
            content: `Domain: ${domain.name}
Description: ${domain.description || 'No description'}
Status: ${domain.status || 'unknown'}
Version: ${domain.version || 'N/A'}

Capabilities:
${capabilities}

Available Agents:
${agents}

Use Cases:
${useCases}

Performance Metrics:
  Success Rate: ${domain.performance?.successRate ? (domain.performance.successRate * 100).toFixed(1) + '%' : 'N/A'}
  Average Response Time: ${domain.performance?.averageResponseTime || 'N/A'}ms
  Tasks Completed: ${domain.performance?.tasksCompleted || 0}

Configuration:
${domain.configuration ? JSON.stringify(domain.configuration, null, 2) : 'No configuration available'}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to get domain information: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'capabilities',
      altName: 'caps',
      description: 'List capabilities across all domains or for a specific domain',
      action: async (context, args) => {
        const domainName = args.trim();
        const orchestrator = context.services.orchestrator;
        
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          let capabilities;
          
          if (domainName) {
            // Get capabilities for specific domain
            const domain = await orchestrator.getDomain(domainName);
            if (!domain) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Domain '${domainName}' not found.`
              };
            }
            capabilities = domain.capabilities || [];
          } else {
            // Get all capabilities across all domains
            capabilities = await orchestrator.getAllCapabilities();
          }

          if (capabilities.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: domainName 
                ? `No capabilities found for domain '${domainName}'.`
                : 'No capabilities available across all domains.'
            };
          }

          // Group capabilities by domain if showing all
          const capabilityGroups = domainName ? 
            { [domainName]: capabilities } : 
            capabilities.reduce((groups: any, cap: any) => {
              const domain = cap.domain || 'unknown';
              if (!groups[domain]) groups[domain] = [];
              groups[domain].push(cap);
              return groups;
            }, {} as Record<string, typeof capabilities>);

          const output = Object.entries(capabilityGroups).map(([domain, caps]) => {
            const capList = (caps as any[]).map((cap: any) => {
              const operations = cap.supportedOperations?.length ? 
                ` (${cap.supportedOperations.join(', ')})` : '';
              const performance = cap.performance ? 
                ` [${cap.performance.latency}ms, ${cap.performance.accuracy * 100}% accuracy]` : '';
              
              return `  • ${cap.name}${operations}${performance}
    ${cap.description || 'No description'}`;
            }).join('\n');

            return `📁 ${domain}:\n${capList}`;
          }).join('\n\n');

          return {
            type: 'message',
            messageType: 'info',
            content: `${domainName ? `Capabilities for ${domainName}` : 'All Available Capabilities'}:\n\n${output}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to get capabilities: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'match',
      description: 'Find domains that match specific requirements',
      action: async (context, args) => {
        const requirements = args.trim();
        if (!requirements) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /domains match <requirement-description>\nExample: /domains match "code analysis and documentation"'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const matches = await orchestrator.findMatchingDomains(requirements);
          
          if (matches.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: `No domains found matching requirements: "${requirements}"\n\nUse /domains list to see all available domains.`
            };
          }

          const matchList = matches.map((match: any) => {
            const confidenceBar = '█'.repeat(Math.round(match.confidence * 10)) + 
                                '░'.repeat(10 - Math.round(match.confidence * 10));
            
            return `📁 ${match.domain.name} (${(match.confidence * 100).toFixed(1)}% match)
  [${confidenceBar}]
  Description: ${match.domain.description || 'No description'}
  Matching Capabilities: ${match.matchingCapabilities?.join(', ') || 'None'}
  Available Agents: ${match.domain.agents?.length || 0}
  
  Why it matches: ${match.reason || 'No explanation available'}`;
          }).join('\n\n');

          return {
            type: 'message',
            messageType: 'info',
            content: `Domain Matches for "${requirements}":\n\n${matchList}\n\nUse /domains show <domain-name> for detailed information.`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to match domains: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'create',
      description: 'Create a new domain with specified capabilities',
      action: async (context, args) => {
        const parts = args.trim().split(' ');
        if (parts.length < 2) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /domains create <domain-name> <description> [capabilities...]'
          };
        }

        const [domainName, ...descriptionParts] = parts;
        const description = descriptionParts.join(' ');
        
        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const domainConfig = {
            name: domainName,
            description,
            version: '1.0.0',
            status: 'active',
            capabilities: [],
            agents: [],
            configuration: {
              maxConcurrentTasks: 10,
              defaultTimeout: 30000
            }
          };

          await orchestrator.createDomain(domainConfig);
          
          return {
            type: 'message',
            messageType: 'success',
            content: `Domain '${domainName}' created successfully.\n\nNext steps:\n1. Use /agents create to add agents to this domain\n2. Use /domains show ${domainName} to verify configuration`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to create domain '${domainName}': ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'stats',
      description: 'Show performance statistics for domains',
      action: async (context, args) => {
        const domainName = args.trim();
        const orchestrator = context.services.orchestrator;
        
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const stats = domainName ? 
            await orchestrator.getDomainStats(domainName) :
            await orchestrator.getAllDomainStats();

          if (!stats || (Array.isArray(stats) && stats.length === 0)) {
            return {
              type: 'message',
              messageType: 'info',
              content: domainName ? 
                `No statistics available for domain '${domainName}'.` :
                'No domain statistics available.'
            };
          }

          const formatStats = (stat: any) => {
            const successRate = (stat.successRate * 100).toFixed(1);
            const utilizationRate = (stat.utilizationRate * 100).toFixed(1);
            
            return `📊 ${stat.domainName}:
  Success Rate: ${successRate}%
  Average Response Time: ${stat.averageResponseTime}ms
  Tasks Completed: ${stat.tasksCompleted}
  Active Agents: ${stat.activeAgents}/${stat.totalAgents}
  Utilization: ${utilizationRate}%
  Error Rate: ${((1 - stat.successRate) * 100).toFixed(1)}%
  
  Recent Performance:
    Last Hour: ${stat.recentMetrics?.lastHour || 'N/A'} tasks
    Last Day: ${stat.recentMetrics?.lastDay || 'N/A'} tasks
    Peak Load: ${stat.recentMetrics?.peakLoad || 'N/A'} concurrent tasks`;
          };

          const output = Array.isArray(stats) ? 
            stats.map((stat: any) => formatStats(stat)).join('\n\n') :
            formatStats(stats);

          return {
            type: 'message',
            messageType: 'info',
            content: `Domain Performance Statistics:\n\n${output}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to get domain statistics: ${(error as Error).message}`
          };
        }
      }
    }
  ]
};