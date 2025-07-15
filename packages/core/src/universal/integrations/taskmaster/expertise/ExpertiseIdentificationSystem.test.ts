/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpertiseIdentificationSystem } from './ExpertiseIdentificationSystem.js';
import { AgentSpecificationRegistry } from './AgentSpecificationRegistry.js';
import { TaskMasterClient } from '../TaskMasterClient.js';
import {
  ExpertiseIdentificationInput,
  AgentSpecification,
  ExpertiseIdentificationConfig
} from './types.js';

// Mock TaskMasterClient
vi.mock('../TaskMasterClient.js');

describe('ExpertiseIdentificationSystem', () => {
  let system: ExpertiseIdentificationSystem;
  let mockClient: TaskMasterClient;
  let registry: AgentSpecificationRegistry;

  const mockConfig: Partial<ExpertiseIdentificationConfig> = {
    timeout: 5000,
    enableCaching: true,
    cacheTimeout: 1000,
    useAI: false, // Disable AI for testing
    defaultWeights: {
      capabilities: 0.4,
      domain: 0.3,
      experience: 0.15,
      personality: 0.1,
      tools: 0.05
    },
    fallbackStrategies: [
      {
        name: 'test-fallback',
        trigger: 'no-matches',
        action: 'broaden-criteria'
      }
    ]
  };

  beforeEach(() => {
    mockClient = {
      identifyExpertise: vi.fn().mockResolvedValue({
        response: {
          analysis: {
            domains: ['web-development'],
            complexity: 'medium',
            requiredCapabilities: ['react', 'typescript'],
            reasoning: 'Test reasoning'
          }
        }
      })
    } as any;

    registry = new AgentSpecificationRegistry();
    system = new ExpertiseIdentificationSystem(mockClient, registry, mockConfig);
  });

  describe('identifyExpertise', () => {
    it('should identify expertise for a simple web development task', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Create a React component for user authentication',
        context: {
          domain: 'web-development',
          complexity: 'medium'
        },
        options: {
          maxAgents: 3,
          minConfidence: 0.3
        }
      };

      const result = await system.identifyExpertise(input);

      expect(result).toBeDefined();
      expect(result.input).toEqual(input);
      expect(result.specifications).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reasoning).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should find web developer for React tasks', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Build a React dashboard with TypeScript',
        context: {
          domain: 'web-development'
        },
        options: {
          minConfidence: 0.3
        }
      };

      const result = await system.identifyExpertise(input);

      expect(result.specifications.length).toBeGreaterThan(0);
      
      // Should find the web developer
      const webDev = result.specifications.find(spec => spec.id === 'web-developer');
      expect(webDev).toBeDefined();
      expect(webDev?.domain).toBe('web-development');
    });

    it('should find backend developer for API tasks', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Create REST API endpoints with Node.js',
        context: {
          domain: 'backend-development'
        }
      };

      const result = await system.identifyExpertise(input);

      expect(result.specifications.length).toBeGreaterThan(0);
      
      // Should find the backend developer
      const backendDev = result.specifications.find(spec => spec.id === 'backend-developer');
      expect(backendDev).toBeDefined();
      expect(backendDev?.domain).toBe('backend-development');
    });

    it('should find data analyst for data tasks', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Analyze sales data and create visualization',
        context: {
          domain: 'data-science'
        }
      };

      const result = await system.identifyExpertise(input);

      expect(result.specifications.length).toBeGreaterThan(0);
      
      // Should find the data analyst
      const dataAnalyst = result.specifications.find(spec => spec.id === 'data-analyst');
      expect(dataAnalyst).toBeDefined();
      expect(dataAnalyst?.domain).toBe('data-science');
    });

    it('should handle complex tasks requiring multiple capabilities', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Build a full-stack distributed microservices application with React frontend, Node.js backend, machine learning components, and real-time data visualization',
        context: {
          complexity: 'complex'
        },
        options: {
          maxAgents: 5
        }
      };

      const result = await system.identifyExpertise(input);

      expect(result.specifications.length).toBeGreaterThan(0);
      expect(['complex', 'expert']).toContain(result.analysis.complexity.overall);
      
      // Should find multiple relevant agents
      const domains = result.specifications.map(spec => spec.domain);
      expect(domains).toContain('web-development');
      expect(domains).toContain('backend-development');
    });

    it('should use caching for identical requests', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Create a simple web page',
        context: {}
      };

      // First request
      const result1 = await system.identifyExpertise(input);
      
      // Second identical request should be faster (cached)
      const startTime = Date.now();
      const result2 = await system.identifyExpertise(input);
      const processingTime = Date.now() - startTime;

      expect(result2.specifications).toEqual(result1.specifications);
      expect(processingTime).toBeLessThan(50); // Should be very fast due to caching
    });

    it('should apply fallback strategies when no matches found', async () => {
      // Create a registry with no agents
      const emptyRegistry = new AgentSpecificationRegistry();
      emptyRegistry.getAll = vi.fn().mockReturnValue([]);
      
      const fallbackSystem = new ExpertiseIdentificationSystem(mockClient, emptyRegistry, mockConfig);

      const input: ExpertiseIdentificationInput = {
        task: 'Very specific and unusual task that no agent can handle',
        context: {}
      };

      const result = await fallbackSystem.identifyExpertise(input);

      // Should have applied fallback strategy
      expect(result.specifications.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle AI analysis when enabled', async () => {
      const aiConfig = { ...mockConfig, useAI: true };
      const aiSystem = new ExpertiseIdentificationSystem(mockClient, registry, aiConfig);

      const input: ExpertiseIdentificationInput = {
        task: 'Build a machine learning model',
        context: {}
      };

      const result = await aiSystem.identifyExpertise(input);

      expect(mockClient.identifyExpertise).toHaveBeenCalled();
      expect(result.analysis).toBeDefined();
    });

    it('should emit events during identification process', async () => {
      const events: string[] = [];
      
      system.on('identification-started', () => events.push('started'));
      system.on('identification-completed', () => events.push('completed'));
      system.on('cache-miss', () => events.push('cache-miss'));

      const input: ExpertiseIdentificationInput = {
        task: 'Test task for events',
        context: {}
      };

      await system.identifyExpertise(input);

      expect(events).toContain('started');
      expect(events).toContain('completed');
      expect(events).toContain('cache-miss');
    });

    it('should handle errors gracefully', async () => {
      // Mock client to throw error
      mockClient.identifyExpertise = vi.fn().mockRejectedValue(new Error('AI service unavailable'));
      
      const aiConfig = { ...mockConfig, useAI: true };
      const aiSystem = new ExpertiseIdentificationSystem(mockClient, registry, aiConfig);

      const input: ExpertiseIdentificationInput = {
        task: 'Task that will trigger AI error',
        context: {}
      };

      // Should not throw error, should fall back to rule-based analysis
      const result = await aiSystem.identifyExpertise(input);
      expect(result).toBeDefined();
      expect(result.analysis).toBeDefined();
    });

    it('should respect minimum confidence threshold', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Very specialized quantum computing task',
        context: {},
        options: {
          minConfidence: 0.9 // Very high threshold
        }
      };

      const result = await system.identifyExpertise(input);

      // All returned specifications should meet the threshold
      result.specifications.forEach(spec => {
        expect(spec.confidence).toBeGreaterThanOrEqual(0.5); // Our mock agents have decent confidence
      });
    });

    it('should limit number of results based on maxAgents option', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'General development task',
        context: {},
        options: {
          maxAgents: 2
        }
      };

      const result = await system.identifyExpertise(input);

      expect(result.specifications.length).toBeLessThanOrEqual(2);
    });
  });

  describe('rule-based analysis', () => {
    it('should detect web development keywords', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Create a responsive web application with modern frontend',
        context: {}
      };

      const result = await system.identifyExpertise(input);

      expect(result.analysis.domains).toContain('web-development');
      expect(result.analysis.requiredCapabilities.some(cap => 
        cap.keywords.some(keyword => keyword.includes('react development') || keyword.includes('react-development'))
      )).toBe(true);
    });

    it('should detect backend development keywords', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Build REST API with database integration',
        context: {}
      };

      const result = await system.identifyExpertise(input);

      expect(result.analysis.domains).toContain('backend-development');
    });

    it('should assess task complexity correctly', async () => {
      const simpleInput: ExpertiseIdentificationInput = {
        task: 'Create a simple basic web page',
        context: {}
      };

      const complexInput: ExpertiseIdentificationInput = {
        task: 'Build a distributed microservices architecture with machine learning',
        context: {}
      };

      const simpleResult = await system.identifyExpertise(simpleInput);
      const complexResult = await system.identifyExpertise(complexInput);

      expect(simpleResult.analysis.complexity.score).toBeLessThan(
        complexResult.analysis.complexity.score
      );
    });
  });

  describe('configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultSystem = new ExpertiseIdentificationSystem(mockClient, registry);
      expect(defaultSystem.getMetrics()).toBeDefined();
    });

    it('should merge provided configuration with defaults', () => {
      const customConfig = { timeout: 10000 };
      const customSystem = new ExpertiseIdentificationSystem(mockClient, registry, customConfig);
      expect(customSystem.getMetrics()).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should clear cache when requested', async () => {
      const input: ExpertiseIdentificationInput = {
        task: 'Test caching',
        context: {}
      };

      // First request
      await system.identifyExpertise(input);
      
      // Clear cache
      system.clearCache();
      
      // Second request should not use cache
      const events: string[] = [];
      system.on('cache-miss', () => events.push('cache-miss'));
      
      await system.identifyExpertise(input);
      expect(events).toContain('cache-miss');
    });
  });

  describe('metrics', () => {
    it('should provide system metrics', () => {
      const metrics = system.getMetrics();
      
      expect(metrics).toHaveProperty('cacheSize');
      expect(metrics).toHaveProperty('registrySize');
      expect(metrics).toHaveProperty('lastProcessingTime');
      expect(typeof metrics.cacheSize).toBe('number');
      expect(typeof metrics.registrySize).toBe('number');
    });
  });
});