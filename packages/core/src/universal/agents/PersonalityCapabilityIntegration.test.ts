/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentFactory } from './AgentFactory.js';
import { PersonalityCapabilityManager } from './PersonalityCapabilityManager.js';
import { PersonalityGenerator } from './personality/PersonalityGenerator.js';
import { CapabilityRegistry } from './capabilities/CapabilityRegistry.js';
import { IntegratedPersonality } from './personality/IntegratedPersonality.js';
import { IntegratedCapability } from './capabilities/IntegratedCapability.js';
import { AgentConfig } from './types.js';

describe('Personality and Capability Integration', () => {
  let factory: AgentFactory;
  let personalityGenerator: PersonalityGenerator;
  let capabilityRegistry: CapabilityRegistry;
  let manager: PersonalityCapabilityManager;

  beforeEach(() => {
    factory = new AgentFactory({
      enableMetrics: true,
      enableValidation: true,
      maxConcurrentAgents: 10
    });
    
    personalityGenerator = factory.getPersonalityGenerator();
    capabilityRegistry = factory.getCapabilityRegistry();
    manager = factory.getPersonalityCapabilityManager();
  });

  describe('PersonalityGenerator Integration', () => {
    it('should generate personality with default templates', async () => {
      const config = {
        domain: 'technical',
        role: 'developer',
        requirements: ['analytical thinking'],
        constraints: []
      };

      const personality = await personalityGenerator.generatePersonality(config);
      
      expect(personality).toBeDefined();
      expect(personality.id).toBeDefined();
      expect(personality.traits.length).toBeGreaterThan(0);
      expect(personality.communicationStyle).toBeDefined();
      expect(personality.behaviors).toBeDefined();
    });

    it('should generate personality optimized for specific capabilities', async () => {
      const capabilities = ['programming', 'data-analysis'];
      const context = {
        domain: 'technical',
        role: 'developer',
        requirements: [],
        constraints: [],
        existingCapabilities: capabilities,
        userPreferences: {},
        collaborationNeeds: []
      };

      const personality = await manager.generateOptimalPersonality(capabilities, context);
      
      expect(personality).toBeDefined();
      expect(personality.traits.some(t => t.name === 'analytical')).toBeTruthy();
      expect(personality.getStrengthScore('technical')).toBeGreaterThan(0.5);
    });

    it('should check personality-capability compatibility', async () => {
      const personality = await personalityGenerator.generatePersonality({
        domain: 'creative',
        role: 'designer'
      });

      const integratedPersonality = new IntegratedPersonality(personality);
      const capabilities = ['creative-writing', 'design'];
      
      const compatibility = await integratedPersonality.isCompatibleWith(capabilities);
      
      expect(compatibility).toBeDefined();
      expect(compatibility.compatible).toBeTruthy();
      expect(compatibility.score).toBeGreaterThan(0.6);
    });
  });

  describe('CapabilityRegistry Integration', () => {
    it('should have default capabilities registered', () => {
      const stats = capabilityRegistry.getStatistics();
      
      expect(stats.totalCapabilities).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.byLevel).toBeDefined();
    });

    it('should search capabilities by criteria', () => {
      const criteria = {
        category: 'technical',
        level: 'intermediate'
      };

      const capabilities = capabilityRegistry.searchCapabilities(criteria);
      
      expect(capabilities).toBeDefined();
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities[0].category).toBe('technical');
    });

    it('should assign capabilities to agent context', () => {
      const capabilityIds = ['programming', 'data-analysis'];
      const domain = 'technical';

      const assignment = capabilityRegistry.assignCapabilities(capabilityIds, domain);
      
      expect(assignment).toBeDefined();
      expect(assignment.assigned).toHaveLength(capabilityIds.length);
      expect(assignment.totalComplexity).toBeGreaterThan(0);
      expect(assignment.estimatedPerformance).toBeDefined();
    });

    it('should validate capability dependencies', () => {
      const capabilityIds = ['programming', 'data-analysis'];
      
      const validation = capabilityRegistry.validateCapabilities(capabilityIds);
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBeTruthy();
      expect(validation.dependencies).toBeDefined();
    });
  });

  describe('IntegratedCapability', () => {
    it('should create integrated capability from extended capability', () => {
      const extendedCap = capabilityRegistry.getCapability('programming');
      expect(extendedCap).toBeDefined();

      const integratedCap = new IntegratedCapability(extendedCap!);
      
      expect(integratedCap.id).toBe(extendedCap!.id);
      expect(integratedCap.name).toBe(extendedCap!.name);
      expect(integratedCap.category).toBe(extendedCap!.category);
    });

    it('should get capability dependencies', async () => {
      const extendedCap = capabilityRegistry.getCapability('data-analysis');
      const integratedCap = new IntegratedCapability(extendedCap!);
      
      const dependencies = await integratedCap.getDependencies();
      
      expect(dependencies).toBeDefined();
      expect(dependencies.length).toBeGreaterThan(0);
      expect(dependencies[0].capabilityId).toBeDefined();
    });

    it('should get compatibility requirements', () => {
      const extendedCap = capabilityRegistry.getCapability('creative-writing');
      const integratedCap = new IntegratedCapability(extendedCap!);
      
      const requirements = integratedCap.getCompatibilityRequirements();
      
      expect(requirements).toBeDefined();
      expect(requirements.length).toBeGreaterThan(0);
      expect(requirements.some(r => r.type === 'personality')).toBeTruthy();
    });

    it('should execute capability with parameters', async () => {
      const extendedCap = capabilityRegistry.getCapability('communication');
      const integratedCap = new IntegratedCapability(extendedCap!);
      
      const params = { message: 'Hello world' };
      const context = {
        agentId: 'test-agent',
        sessionId: 'test-session',
        environment: {},
        previousResults: [],
        timeoutMs: 5000
      };

      const result = await integratedCap.execute(params, context);
      
      expect(result).toBeDefined();
      expect(result.success).toBeTruthy();
      expect(result.result).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('PersonalityCapabilityManager', () => {
    it('should generate optimal personality for capabilities', async () => {
      const capabilities = ['programming', 'problem-solving'];
      const context = {
        domain: 'technical',
        role: 'developer',
        requirements: ['analytical thinking'],
        constraints: [],
        existingCapabilities: capabilities,
        userPreferences: {},
        collaborationNeeds: []
      };

      const personality = await manager.generateOptimalPersonality(capabilities, context);
      
      expect(personality).toBeDefined();
      expect(personality.traits.some(t => t.name === 'analytical' && t.value > 0.7)).toBeTruthy();
    });

    it('should assign optimal capabilities for personality', async () => {
      // First generate a personality
      const personality = await manager.generateOptimalPersonality(
        ['creative-writing'],
        {
          domain: 'creative',
          role: 'writer',
          requirements: [],
          constraints: [],
          existingCapabilities: ['creative-writing'],
          userPreferences: {},
          collaborationNeeds: []
        }
      );

      // Then assign capabilities
      const capabilities = await manager.assignOptimalCapabilities(personality.id, {
        personalityId: personality.id,
        domain: 'creative',
        role: 'writer',
        requiredCapabilities: ['creative-writing'],
        optionalCapabilities: ['communication'],
        constraints: [],
        performanceRequirements: {}
      });
      
      expect(capabilities).toBeDefined();
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.some(c => c.id === 'creative-writing')).toBeTruthy();
    });

    it('should check compatibility between personality and capabilities', async () => {
      const personality = await manager.generateOptimalPersonality(
        ['data-analysis'],
        {
          domain: 'analytical',
          role: 'analyst',
          requirements: [],
          constraints: [],
          existingCapabilities: ['data-analysis'],
          userPreferences: {},
          collaborationNeeds: []
        }
      );

      const capabilities = ['data-analysis', 'problem-solving'];
      const compatibility = await manager.checkCompatibility(personality.id, capabilities);
      
      expect(compatibility).toBeDefined();
      expect(compatibility.score).toBeGreaterThan(0.5);
      expect(compatibility.compatible).toBeTruthy();
    });

    it('should provide optimization recommendations', async () => {
      const personality = await manager.generateOptimalPersonality(
        ['creative-writing'],
        {
          domain: 'creative',
          role: 'writer',
          requirements: [],
          constraints: [],
          existingCapabilities: ['creative-writing'],
          userPreferences: {},
          collaborationNeeds: []
        }
      );

      // Test with mismatched capabilities
      const capabilities = ['data-analysis', 'programming'];
      const recommendations = await manager.getOptimizationRecommendations(
        personality.id, 
        capabilities
      );
      
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].type).toBeDefined();
      expect(recommendations[0].priority).toBeDefined();
    });

    it('should get performance analytics', async () => {
      const analytics = await manager.getAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics.totalAgents).toBeGreaterThanOrEqual(0);
      expect(analytics.averageCompatibilityScore).toBeGreaterThanOrEqual(0);
      expect(analytics.topPerformingCombinations).toBeDefined();
      expect(analytics.commonIssues).toBeDefined();
    });
  });

  describe('AgentFactory Integration', () => {
    it('should get personality generator from factory', () => {
      const generator = factory.getPersonalityGenerator();
      
      expect(generator).toBeDefined();
      expect(generator).toBeInstanceOf(PersonalityGenerator);
    });

    it('should get capability registry from factory', () => {
      const registry = factory.getCapabilityRegistry();
      
      expect(registry).toBeDefined();
      expect(registry).toBeInstanceOf(CapabilityRegistry);
    });

    it('should get personality-capability manager from factory', () => {
      const manager = factory.getPersonalityCapabilityManager();
      
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(PersonalityCapabilityManager);
    });

    it('should get composition strategies', () => {
      const strategies = factory.getCompositionStrategies();
      
      expect(strategies).toBeDefined();
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0].id).toBeDefined();
      expect(strategies[0].name).toBeDefined();
    });

    it('should get compatibility matrix', async () => {
      const matrix = await factory.getCompatibilityMatrix();
      
      expect(matrix).toBeDefined();
      expect(typeof matrix).toBe('object');
    });

    it('should create agent with optimization', async () => {
      // Register a mock agent creator for testing
      factory.registerAgentType('technical:developer', async (config) => {
        // Mock agent that satisfies IAgent interface
        return {
          id: `agent-${Date.now()}`,
          definition: {
            id: 'test-def',
            domain: config.domain,
            role: config.role,
            description: 'Test agent',
            capabilities: [],
            personalityTraits: config.personalityTraits || [],
            tools: [],
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          state: 'ready' as const,
          memory: {
            store: async () => 'test-id',
            retrieve: async () => [],
            update: async () => {},
            delete: async () => {},
            clear: async () => {}
          },
          execute: async () => ({
            type: 'text' as const,
            content: 'Test response'
          }),
          getCapabilities: () => [],
          getPersonality: () => config.personalityTraits || [],
          getTools: () => [],
          initialize: async () => {},
          pause: async () => {},
          resume: async () => {},
          terminate: async () => {},
          getHealth: () => ({
            status: 'healthy' as const,
            uptime: 1000,
            memoryUsage: 100,
            executionCount: 1,
            errorCount: 0,
            lastActivity: new Date()
          }),
          updateConfig: async () => {},
          serialize: async () => '{}',
          deserialize: async () => {},
          on: () => ({} as any),
          emit: () => false
        } as any;
      });

      const config: AgentConfig = {
        domain: 'technical',
        role: 'developer',
        capabilities: ['programming', 'problem-solving']
      };

      const agent = await factory.createAgentWithOptimization(config);
      
      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.definition.domain).toBe('technical');
      expect(agent.definition.role).toBe('developer');
    });
  });

  describe('Integration Event System', () => {
    it('should emit events during personality generation', async () => {
      const events: any[] = [];
      
      manager.on('personality-generated', (data) => {
        events.push({ type: 'personality-generated', data });
      });

      await manager.generateOptimalPersonality(
        ['communication'],
        {
          domain: 'social',
          role: 'assistant',
          requirements: [],
          constraints: [],
          existingCapabilities: ['communication'],
          userPreferences: {},
          collaborationNeeds: []
        }
      );

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('personality-generated');
    });

    it('should emit events during capability assignment', async () => {
      const events: any[] = [];
      
      manager.on('capabilities-assigned', (data) => {
        events.push({ type: 'capabilities-assigned', data });
      });

      // Generate personality first
      const personality = await manager.generateOptimalPersonality(
        ['communication'],
        {
          domain: 'social',
          role: 'assistant',
          requirements: [],
          constraints: [],
          existingCapabilities: ['communication'],
          userPreferences: {},
          collaborationNeeds: []
        }
      );

      // Assign capabilities
      await manager.assignOptimalCapabilities(personality.id, {
        personalityId: personality.id,
        domain: 'social',
        role: 'assistant',
        requiredCapabilities: ['communication'],
        optionalCapabilities: [],
        constraints: [],
        performanceRequirements: {}
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('capabilities-assigned');
    });
  });

  describe('Validation and Error Handling', () => {
    it('should validate personality-capability combinations', async () => {
      const personality = await manager.generateOptimalPersonality(
        ['creative-writing'],
        {
          domain: 'creative',
          role: 'writer',
          requirements: [],
          constraints: [],
          existingCapabilities: ['creative-writing'],
          userPreferences: {},
          collaborationNeeds: []
        }
      );

      // Test with conflicting capabilities
      const conflictingCapabilities = ['data-analysis', 'technical-analysis'];
      const compatibility = await manager.checkCompatibility(personality.id, conflictingCapabilities);
      
      // Should have low compatibility or conflicts
      expect(compatibility.score).toBeLessThan(0.8);
    });

    it('should handle missing personality gracefully', async () => {
      await expect(
        manager.checkCompatibility('non-existent-personality', ['test-capability'])
      ).rejects.toThrow('Personality not found');
    });

    it('should validate capability configuration', () => {
      const extendedCap = capabilityRegistry.getCapability('programming');
      const integratedCap = new IntegratedCapability(extendedCap!);
      
      const validConfig = { language: 'typescript', complexity: 'intermediate' };
      const validation = integratedCap.validateConfiguration(validConfig);
      
      expect(validation.valid).toBeTruthy();
      expect(validation.errors.length).toBe(0);
    });
  });
});