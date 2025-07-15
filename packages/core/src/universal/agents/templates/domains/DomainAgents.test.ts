/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentFactory } from '../../AgentFactory.js';
import { 
  CustomerServiceAgent, 
  DataAnalysisAgent, 
  CreativeAssistantAgent, 
  TechnicalSupportAgent,
  DOMAIN_AGENT_REGISTRY,
  DOMAIN_TEMPLATE_REGISTRY,
  DomainAgentUtils
} from './index.js';
import { AgentTemplateSystem } from '../AgentTemplateSystem.js';

describe('Domain-Specific Agents', () => {
  let agentFactory: AgentFactory;
  let templateSystem: AgentTemplateSystem;

  beforeEach(() => {
    agentFactory = new AgentFactory();
    templateSystem = new AgentTemplateSystem();
    
    // Manually register domain templates for testing
    templateSystem.registerDomainTemplates(DOMAIN_TEMPLATE_REGISTRY);
    agentFactory.getTemplateSystem().registerDomainTemplates(DOMAIN_TEMPLATE_REGISTRY);
  });

  describe('CustomerServiceAgent', () => {
    it('should create customer service agent with proper configuration', async () => {
      const config = {
        domain: 'customer-service',
        role: 'support',
        capabilities: ['customer-communication', 'issue-resolution'],
        personalityTraits: [
          { name: 'empathetic', value: 0.9, description: 'Highly empathetic', category: 'social' as const }
        ],
        tools: ['knowledge-base']
      };

      const agent = new CustomerServiceAgent(config);
      expect(agent).toBeDefined();
      expect(agent.id).toBeTruthy();
    });

    it('should process customer service requests', async () => {
      const config = {
        domain: 'customer-service',
        role: 'support',
        capabilities: ['customer-communication'],
        personalityTraits: [],
        tools: []
      };

      const agent = new CustomerServiceAgent(config);
      await agent.initialize(); // Initialize the agent to ready state
      
      const request = {
        input: 'I have a problem with my account login',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: { name: 'test' }
        },
        issueType: 'technical' as const,
        priority: 'medium' as const,
        customerInfo: {
          id: 'cust123',
          name: 'John Doe',
          tier: 'basic' as const,
          history: []
        }
      };

      const response = await agent.execute(request);
      expect(response).toBeDefined();
      expect(response.type).toBe('text');
      expect(response.content).toBeTruthy();
    });
  });

  describe('DataAnalysisAgent', () => {
    it('should create data analysis agent with proper configuration', async () => {
      const config = {
        domain: 'data-analysis',
        role: 'analyst',
        capabilities: ['statistical-analysis', 'data-visualization'],
        personalityTraits: [
          { name: 'analytical', value: 0.9, description: 'Highly analytical', category: 'analytical' as const }
        ],
        tools: ['statistical-package']
      };

      const agent = new DataAnalysisAgent(config);
      expect(agent).toBeDefined();
      expect(agent.id).toBeTruthy();
    });

    it('should process data analysis requests', async () => {
      const config = {
        domain: 'data-analysis',
        role: 'analyst',
        capabilities: ['statistical-analysis'],
        personalityTraits: [],
        tools: []
      };

      const agent = new DataAnalysisAgent(config);
      await agent.initialize(); // Initialize the agent to ready state
      
      const request = {
        input: 'Analyze sales data for trends',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: { name: 'test' }
        },
        analysisType: 'descriptive' as const,
        requirements: {
          metrics: ['mean', 'median', 'std'],
          visualizations: ['histogram'],
          confidence_level: 0.95
        },
        outputFormat: 'report' as const
      };

      const response = await agent.execute(request);
      expect(response).toBeDefined();
      expect(response.type).toBe('text');
      expect(response.content).toBeTruthy();
    });
  });

  describe('CreativeAssistantAgent', () => {
    it('should create creative assistant agent with proper configuration', async () => {
      const config = {
        domain: 'creative',
        role: 'assistant',
        capabilities: ['content-generation', 'creative-brainstorming'],
        personalityTraits: [
          { name: 'creative', value: 0.9, description: 'Highly creative', category: 'creativity' as const }
        ],
        tools: ['content-generator']
      };

      const agent = new CreativeAssistantAgent(config);
      expect(agent).toBeDefined();
      expect(agent.id).toBeTruthy();
    });

    it('should process creative assistance requests', async () => {
      const config = {
        domain: 'creative',
        role: 'assistant',
        capabilities: ['content-generation'],
        personalityTraits: [],
        tools: []
      };

      const agent = new CreativeAssistantAgent(config);
      await agent.initialize(); // Initialize the agent to ready state
      
      const request = {
        input: 'Write a blog post about AI',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: { name: 'test' }
        },
        creativeType: 'writing' as const,
        contentFormat: 'blog_post' as const,
        targetAudience: {
          demographics: ['tech professionals'],
          interests: ['AI', 'technology'],
          tone_preference: 'professional' as const
        },
        constraints: {
          word_count: 500,
          keywords: ['artificial intelligence', 'machine learning']
        }
      };

      const response = await agent.execute(request);
      expect(response).toBeDefined();
      expect(response.type).toBe('text');
      expect(response.content).toBeTruthy();
    });
  });

  describe('TechnicalSupportAgent', () => {
    it('should create technical support agent with proper configuration', async () => {
      const config = {
        domain: 'technical-support',
        role: 'specialist',
        capabilities: ['system-diagnostics', 'troubleshooting'],
        personalityTraits: [
          { name: 'systematic', value: 0.9, description: 'Systematic approach', category: 'problem-solving' as const }
        ],
        tools: ['diagnostic-suite']
      };

      const agent = new TechnicalSupportAgent(config);
      expect(agent).toBeDefined();
      expect(agent.id).toBeTruthy();
    });

    it('should process technical support requests', async () => {
      const config = {
        domain: 'technical-support',
        role: 'specialist',
        capabilities: ['system-diagnostics'],
        personalityTraits: [],
        tools: []
      };

      const agent = new TechnicalSupportAgent(config);
      await agent.initialize(); // Initialize the agent to ready state
      
      const request = {
        input: 'My application is crashing with error 500',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: { name: 'test' }
        },
        issueCategory: 'software' as const,
        severity: 'medium' as const,
        systemInfo: {
          os: 'Windows',
          version: '11',
          browser: 'Chrome',
          device_type: 'desktop' as const,
          environment: 'production' as const
        },
        errorDetails: {
          error_code: '500',
          error_message: 'Internal Server Error',
          reproduction_steps: ['Open app', 'Click submit', 'Error occurs']
        },
        userLevel: 'intermediate' as const,
        urgency: false
      };

      const response = await agent.execute(request);
      expect(response).toBeDefined();
      expect(response.type).toBe('text');
      expect(response.content).toBeTruthy();
    });
  });

  describe('Domain Agent Registry', () => {
    it('should have all expected domain agents registered', () => {
      expect(DOMAIN_AGENT_REGISTRY.size).toBe(4);
      expect(DOMAIN_AGENT_REGISTRY.has('customer-service:support')).toBe(true);
      expect(DOMAIN_AGENT_REGISTRY.has('data-analysis:analyst')).toBe(true);
      expect(DOMAIN_AGENT_REGISTRY.has('creative:assistant')).toBe(true);
      expect(DOMAIN_AGENT_REGISTRY.has('technical-support:specialist')).toBe(true);
    });

    it('should provide correct agent constructors', () => {
      const customerServiceConstructor = DOMAIN_AGENT_REGISTRY.get('customer-service:support');
      const dataAnalysisConstructor = DOMAIN_AGENT_REGISTRY.get('data-analysis:analyst');
      const creativeConstructor = DOMAIN_AGENT_REGISTRY.get('creative:assistant');
      const technicalConstructor = DOMAIN_AGENT_REGISTRY.get('technical-support:specialist');

      expect(customerServiceConstructor).toBe(CustomerServiceAgent);
      expect(dataAnalysisConstructor).toBe(DataAnalysisAgent);
      expect(creativeConstructor).toBe(CreativeAssistantAgent);
      expect(technicalConstructor).toBe(TechnicalSupportAgent);
    });
  });

  describe('DomainAgentUtils', () => {
    it('should get available domains', () => {
      const domains = DomainAgentUtils.getAvailableDomains();
      expect(domains).toContain('customer-service:support');
      expect(domains).toContain('data-analysis:analyst');
      expect(domains).toContain('creative:assistant');
      expect(domains).toContain('technical-support:specialist');
    });

    it('should get agent constructor by domain and role', () => {
      const constructor = DomainAgentUtils.getAgentConstructor('customer-service', 'support');
      expect(constructor).toBe(CustomerServiceAgent);

      const nullConstructor = DomainAgentUtils.getAgentConstructor('non-existent', 'role');
      expect(nullConstructor).toBeNull();
    });

    it('should check if agent exists', () => {
      expect(DomainAgentUtils.hasAgent('customer-service', 'support')).toBe(true);
      expect(DomainAgentUtils.hasAgent('non-existent', 'role')).toBe(false);
    });

    it('should recommend agents for task descriptions', () => {
      expect(DomainAgentUtils.getRecommendedAgent('customer support issue')).toBe('customer-service:support');
      expect(DomainAgentUtils.getRecommendedAgent('analyze sales data')).toBe('data-analysis:analyst');
      expect(DomainAgentUtils.getRecommendedAgent('write blog content')).toBe('creative:assistant');
      expect(DomainAgentUtils.getRecommendedAgent('fix technical bug')).toBe('technical-support:specialist');
      expect(DomainAgentUtils.getRecommendedAgent('something unrelated')).toBeNull();
    });

    it('should get agent summaries', () => {
      const summary = DomainAgentUtils.getAgentSummary('customer-service', 'support');
      expect(summary).toBeDefined();
      expect(summary?.domain).toBe('customer-service');
      expect(summary?.role).toBe('support');
      expect(summary?.capabilities).toContain('customer-communication');
    });

    it('should validate agent configuration', () => {
      const config = {
        domain: 'customer-service',
        role: 'support',
        capabilities: ['customer-communication'],
        personalityTraits: [],
        tools: []
      };

      const validation = DomainAgentUtils.validateAgentConfig('customer-service', 'support', config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should create default configuration from template', () => {
      const config = DomainAgentUtils.createDefaultConfig('customer-service', 'support');
      expect(config).toBeDefined();
      expect(config?.domain).toBe('customer-service');
      expect(config?.role).toBe('support');
      expect(config?.capabilities).toContain('customer-communication');
    });
  });

  describe('AgentFactory Integration', () => {
    it('should create domain agents through factory', async () => {
      const config = {
        domain: 'customer-service',
        role: 'support',
        capabilities: ['customer-communication'],
        personalityTraits: [],
        tools: []
      };

      const agent = await agentFactory.createAgent(config);
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(CustomerServiceAgent);
    });

    it('should create agent from template through factory', async () => {
      const agent = await agentFactory.createAgentFromTemplate('customer-service', 'support');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(CustomerServiceAgent);
    });

    it('should get available domain agents from factory', () => {
      const domainAgents = agentFactory.getAvailableDomainAgents();
      expect(domainAgents).toBeDefined();
      expect(Object.keys(domainAgents)).toContain('Customer Service');
      expect(Object.keys(domainAgents)).toContain('Data Analysis');
      expect(Object.keys(domainAgents)).toContain('Creative');
      expect(Object.keys(domainAgents)).toContain('Technical Support');
    });

    it('should get recommended agent for task through factory', () => {
      const recommendation = agentFactory.getRecommendedAgentForTask('customer service issue');
      expect(recommendation).toBe('customer-service:support');
    });
  });

  describe('Template System Integration', () => {
    it('should register all domain templates', () => {
      const templateSystem = agentFactory.getTemplateSystem();
      const stats = templateSystem.getStatistics();
      expect(stats.totalTemplates).toBeGreaterThanOrEqual(4);
    });

    it('should get template for domain', () => {
      const templateSystem = agentFactory.getTemplateSystem();
      const template = templateSystem.getTemplate('customer-service', 'support');
      expect(template).toBeDefined();
      expect(template?.domain).toBe('customer-service');
      expect(template?.role).toBe('support');
    });

    it('should search templates by criteria', () => {
      const templateSystem = agentFactory.getTemplateSystem();
      const customerServiceTemplates = templateSystem.searchTemplates({
        domain: 'customer-service'
      });
      expect(customerServiceTemplates).toHaveLength(1);
      expect(customerServiceTemplates[0].domain).toBe('customer-service');
    });

    it('should create agent config from template', () => {
      const templateSystem = agentFactory.getTemplateSystem();
      const config = templateSystem.createAgentConfig('customer-service:support');
      expect(config).toBeDefined();
      expect(config.domain).toBe('customer-service');
      expect(config.role).toBe('support');
    });
  });
});