/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export all domain-specific agents and templates
export { CustomerServiceAgent, CustomerServiceTemplate } from './CustomerServiceAgent.js';
export { DataAnalysisAgent, DataAnalysisTemplate } from './DataAnalysisAgent.js';
export { CreativeAssistantAgent, CreativeAssistantTemplate } from './CreativeAssistantAgent.js';
export { TechnicalSupportAgent, TechnicalSupportTemplate } from './TechnicalSupportAgent.js';

// Export domain-specific request and response types
export type {
  CustomerServiceRequest,
  CustomerServiceResponse
} from './CustomerServiceAgent.js';

export type {
  DataAnalysisRequest,
  DataAnalysisResponse
} from './DataAnalysisAgent.js';

export type {
  CreativeAssistantRequest,
  CreativeAssistantResponse
} from './CreativeAssistantAgent.js';

export type {
  TechnicalSupportRequest,
  TechnicalSupportResponse
} from './TechnicalSupportAgent.js';

import { CustomerServiceAgent, CustomerServiceTemplate } from './CustomerServiceAgent.js';
import { DataAnalysisAgent, DataAnalysisTemplate } from './DataAnalysisAgent.js';
import { CreativeAssistantAgent, CreativeAssistantTemplate } from './CreativeAssistantAgent.js';
import { TechnicalSupportAgent, TechnicalSupportTemplate } from './TechnicalSupportAgent.js';
import { DomainAgentTemplate } from '../AgentTemplateSystem.js';
import { IAgent, AgentConfig } from '../../types.js';
import { ImageAltTextAgent } from '../../ImageAltTextAgent.js';

/**
 * Domain agent class constructor type
 */
export type DomainAgentConstructor = new (config: AgentConfig) => IAgent;

/**
 * Registry of all domain-specific agents
 */
export const DOMAIN_AGENT_REGISTRY: Map<string, DomainAgentConstructor> = new Map([
  ['customer-service:support', CustomerServiceAgent as DomainAgentConstructor],
  ['data-analysis:analyst', DataAnalysisAgent as DomainAgentConstructor],
  ['creative:assistant', CreativeAssistantAgent as DomainAgentConstructor],
  ['technical-support:specialist', TechnicalSupportAgent as DomainAgentConstructor],
  ['document-processing:image-alt-text', ImageAltTextAgent as DomainAgentConstructor]
]);

/**
 * Registry of all domain-specific templates
 */
export const DOMAIN_TEMPLATE_REGISTRY: Map<string, DomainAgentTemplate> = new Map([
  ['customer-service:support', CustomerServiceTemplate],
  ['data-analysis:analyst', DataAnalysisTemplate], 
  ['creative:assistant', CreativeAssistantTemplate],
  ['technical-support:specialist', TechnicalSupportTemplate]
]);

/**
 * Domain categories for organizing agents
 */
export const DOMAIN_CATEGORIES = {
  CUSTOMER_SERVICE: {
    name: 'Customer Service',
    description: 'Agents specialized in customer support and service interactions',
    agents: ['customer-service:support']
  },
  DATA_ANALYSIS: {
    name: 'Data Analysis',
    description: 'Agents specialized in data processing, analysis, and insights generation',
    agents: ['data-analysis:analyst']
  },
  CREATIVE: {
    name: 'Creative',
    description: 'Agents specialized in content creation, brainstorming, and creative tasks',
    agents: ['creative:assistant']
  },
  TECHNICAL_SUPPORT: {
    name: 'Technical Support',
    description: 'Agents specialized in technical troubleshooting and system support',
    agents: ['technical-support:specialist']
  },
  DOCUMENT_PROCESSING: {
    name: 'Document Processing',
    description: 'Agents specialized in document analysis, processing, and accessibility enhancement',
    agents: ['document-processing:image-alt-text']
  }
} as const;

/**
 * Utility functions for domain agent management
 */
export class DomainAgentUtils {
  /**
   * Get all available domain agent types
   */
  static getAvailableDomains(): string[] {
    return Array.from(DOMAIN_AGENT_REGISTRY.keys());
  }

  /**
   * Get agent constructor by domain and role
   */
  static getAgentConstructor(domain: string, role: string): DomainAgentConstructor | null {
    const key = `${domain}:${role}`;
    return DOMAIN_AGENT_REGISTRY.get(key) || null;
  }

  /**
   * Get template by domain and role
   */
  static getTemplate(domain: string, role: string): DomainAgentTemplate | null {
    const key = `${domain}:${role}`;
    return DOMAIN_TEMPLATE_REGISTRY.get(key) || null;
  }

  /**
   * Check if a domain agent exists
   */
  static hasAgent(domain: string, role: string): boolean {
    const key = `${domain}:${role}`;
    return DOMAIN_AGENT_REGISTRY.has(key);
  }

  /**
   * Get all agents in a specific category
   */
  static getAgentsByCategory(category: keyof typeof DOMAIN_CATEGORIES): string[] {
    return [...DOMAIN_CATEGORIES[category].agents];
  }

  /**
   * Get recommended agent for a given task description
   */
  static getRecommendedAgent(taskDescription: string): string | null {
    const lowerTask = taskDescription.toLowerCase();
    
    // Customer service keywords
    if (lowerTask.includes('customer') || lowerTask.includes('support') || 
        lowerTask.includes('service') || lowerTask.includes('complaint') ||
        lowerTask.includes('help')) {
      return 'customer-service:support';
    }
    
    // Data analysis keywords
    if (lowerTask.includes('data') || lowerTask.includes('analysis') || 
        lowerTask.includes('statistics') || lowerTask.includes('chart') ||
        lowerTask.includes('report') || lowerTask.includes('metrics')) {
      return 'data-analysis:analyst';
    }
    
    // Creative keywords
    if (lowerTask.includes('write') || lowerTask.includes('content') || 
        lowerTask.includes('creative') || lowerTask.includes('blog') ||
        lowerTask.includes('marketing') || lowerTask.includes('copy')) {
      return 'creative:assistant';
    }
    
    // Technical support keywords
    if (lowerTask.includes('technical') || lowerTask.includes('troubleshoot') || 
        lowerTask.includes('bug') || lowerTask.includes('error') ||
        lowerTask.includes('system') || lowerTask.includes('fix')) {
      return 'technical-support:specialist';
    }
    
    return null;
  }

  /**
   * Get agent metadata summary
   */
  static getAgentSummary(domain: string, role: string): AgentSummary | null {
    const template = this.getTemplate(domain, role);
    if (!template) return null;
    
    return {
      id: template.id,
      domain: template.domain,
      role: template.role,
      description: template.description,
      category: template.metadata.category,
      capabilities: template.defaultCapabilities,
      examples: template.examples,
      tags: template.metadata.tags
    };
  }

  /**
   * Get all agent summaries grouped by category
   */
  static getAllAgentSummaries(): Record<string, AgentSummary[]> {
    const summaries: Record<string, AgentSummary[]> = {};
    
    Object.entries(DOMAIN_CATEGORIES).forEach(([categoryKey, category]) => {
      summaries[category.name] = category.agents.map(agentId => {
        const [domain, role] = agentId.split(':');
        return this.getAgentSummary(domain, role);
      }).filter(summary => summary !== null) as AgentSummary[];
    });
    
    return summaries;
  }

  /**
   * Validate agent configuration against template
   */
  static validateAgentConfig(domain: string, role: string, config: AgentConfig): ValidationResult {
    const template = this.getTemplate(domain, role);
    if (!template) {
      return {
        valid: false,
        errors: [`Template not found for ${domain}:${role}`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required capabilities
    if (config.capabilities) {
      const missingCapabilities = template.defaultCapabilities.filter(
        cap => !config.capabilities!.includes(cap)
      );
      if (missingCapabilities.length > 0) {
        warnings.push(`Missing default capabilities: ${missingCapabilities.join(', ')}`);
      }
    }

    // Check domain and role match
    if (config.domain !== domain || config.role !== role) {
      errors.push(`Config domain:role (${config.domain}:${config.role}) doesn't match template (${domain}:${role})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create default configuration from template
   */
  static createDefaultConfig(domain: string, role: string): AgentConfig | null {
    const template = this.getTemplate(domain, role);
    if (!template) return null;

    return {
      domain: template.domain,
      role: template.role,
      capabilities: [...template.defaultCapabilities],
      personalityTraits: [...template.defaultPersonalityTraits],
      tools: [...template.defaultTools],
      customSettings: {}
    };
  }
}

/**
 * Agent summary interface
 */
export interface AgentSummary {
  id: string;
  domain: string;
  role: string;
  description: string;
  category: string;
  capabilities: string[];
  examples: string[];
  tags: string[];
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}