/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentMatchingEngine } from './AgentMatchingEngine.js';
import { AgentSpecificationRegistry } from './AgentSpecificationRegistry.js';
import {
  AgentMatchingCriteria,
  AgentSpecification,
  ExpertiseIdentificationConfig
} from './types.js';

describe('AgentMatchingEngine', () => {
  let engine: AgentMatchingEngine;
  let registry: AgentSpecificationRegistry;

  const mockConfig: ExpertiseIdentificationConfig = {
    timeout: 5000,
    enableCaching: true,
    cacheTimeout: 1000,
    useAI: false,
    defaultWeights: {
      capabilities: 0.4,
      domain: 0.3,
      experience: 0.15,
      personality: 0.1,
      tools: 0.05
    },
    fallbackStrategies: []
  };

  const testAgent: AgentSpecification = {
    id: 'test-specialist',
    domain: 'testing',
    role: 'Test Specialist',
    capabilities: [
      {
        id: 'unit-testing',
        name: 'Unit Testing',
        category: 'technical',
        level: 'expert',
        importance: 'critical',
        keywords: ['unit', 'testing', 'jest'],
        description: 'Expert in unit testing frameworks'
      },
      {
        id: 'integration-testing',
        name: 'Integration Testing',
        category: 'technical',
        level: 'advanced',
        importance: 'high',
        keywords: ['integration', 'testing', 'e2e'],
        description: 'Skilled in integration testing'
      }
    ],
    personalityTraits: [
      {
        name: 'detail-oriented',
        strength: 0.9,
        description: 'Very meticulous about details',
        category: 'methodical'
      },
      {
        name: 'analytical',
        strength: 0.8,
        description: 'Strong analytical thinking',
        category: 'analytical'
      }
    ],
    tools: [
      {
        id: 'jest',
        name: 'Jest Testing Framework',
        description: 'JavaScript testing framework',
        category: 'testing',
        parameters: [],
        accessLevel: 'public'
      },
      {
        id: 'cypress',
        name: 'Cypress E2E Testing',
        description: 'End-to-end testing framework',
        category: 'testing',
        parameters: [],
        accessLevel: 'public'
      }
    ],
    confidence: 0.9,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      tags: ['testing', 'qa'],
      author: 'test'
    }
  };

  beforeEach(() => {
    registry = new AgentSpecificationRegistry();
    registry.register(testAgent);
    engine = new AgentMatchingEngine(registry, mockConfig);
  });

  describe('findMatches', () => {
    it('should find agents matching required capabilities', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing'],
        minConfidence: 0.5,
        maxMatches: 5
      };

      const matches = await engine.findMatches(criteria);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].specification.id).toBe('test-specialist');
      expect(matches[0].score).toBeGreaterThan(0.5);
    });

    it('should find agents matching domain', async () => {
      const criteria: AgentMatchingCriteria = {
        domains: ['testing'],
        minConfidence: 0.5,
        maxMatches: 5
      };

      const matches = await engine.findMatches(criteria);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].specification.domain).toBe('testing');
    });

    it('should find agents with web development capabilities', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['react-development'],
        domains: ['web-development'],
        minConfidence: 0.5,
        maxMatches: 5
      };

      const matches = await engine.findMatches(criteria);

      expect(matches.length).toBeGreaterThan(0);
      const webDev = matches.find(m => m.specification.id === 'web-developer');
      expect(webDev).toBeDefined();
    });

    it('should sort results by score (highest first)', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing', 'integration-testing'],
        minConfidence: 0.1,
        maxMatches: 10
      };

      const matches = await engine.findMatches(criteria);

      if (matches.length > 1) {
        // Check that scores are in descending order
        for (let i = 1; i < matches.length; i++) {
          expect(matches[i-1].score).toBeGreaterThanOrEqual(matches[i].score);
        }
      } else {
        // If only one match, that's still valid
        expect(matches.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should respect minimum confidence threshold', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing'],
        minConfidence: 0.95, // Very high threshold
        maxMatches: 5
      };

      const matches = await engine.findMatches(criteria);

      // All matches should meet the threshold
      matches.forEach(match => {
        expect(match.score).toBeGreaterThanOrEqual(0.95);
      });
    });

    it('should respect maximum matches limit', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: [],
        minConfidence: 0.1,
        maxMatches: 2
      };

      const matches = await engine.findMatches(criteria);

      expect(matches.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty criteria gracefully', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: []
      };

      const matches = await engine.findMatches(criteria);

      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeGreaterThan(0); // Should return default agents
    });

    it('should find no matches for very specific non-existent capabilities', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['quantum-computing-expertise'],
        minConfidence: 0.8,
        maxMatches: 5
      };

      const matches = await engine.findMatches(criteria);

      expect(matches.length).toBe(0);
    });
  });

  describe('scoreAgent', () => {
    it('should score agent correctly for exact capability match', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing'],
        domains: ['testing']
      };

      const result = await engine.scoreAgent(testAgent, criteria);

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.scoreBreakdown.capabilities).toBeGreaterThan(0.8);
      expect(result.scoreBreakdown.domain).toBe(1.0); // Exact domain match
    });

    it('should provide detailed score breakdown', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing']
      };

      const result = await engine.scoreAgent(testAgent, criteria);

      expect(result.scoreBreakdown).toHaveProperty('capabilities');
      expect(result.scoreBreakdown).toHaveProperty('domain');
      expect(result.scoreBreakdown).toHaveProperty('experience');
      expect(result.scoreBreakdown).toHaveProperty('personality');
      expect(result.scoreBreakdown).toHaveProperty('tools');
      expect(result.scoreBreakdown).toHaveProperty('total');
      
      // All scores should be between 0 and 1
      Object.values(result.scoreBreakdown).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should generate meaningful match reasons', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing'],
        domains: ['testing']
      };

      const result = await engine.scoreAgent(testAgent, criteria);

      expect(result.matchReasons.length).toBeGreaterThan(0);
      expect(result.matchReasons.some(reason => 
        reason.includes('capability') || reason.includes('domain')
      )).toBe(true);
    });

    it('should identify concerns for poor matches', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['quantum-computing'],
        domains: ['physics']
      };

      const result = await engine.scoreAgent(testAgent, criteria);

      expect(result.concerns).toBeDefined();
      expect(result.concerns!.length).toBeGreaterThan(0);
      expect(result.concerns!.some(concern => 
        concern.includes('Missing') || concern.includes('mismatch')
      )).toBe(true);
    });

    it('should assign appropriate recommendation levels', async () => {
      // High score scenario
      const goodCriteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing'],
        domains: ['testing']
      };

      const goodResult = await engine.scoreAgent(testAgent, goodCriteria);
      expect(['highly-recommended', 'recommended']).toContain(goodResult.recommendation);

      // Low score scenario
      const badCriteria: AgentMatchingCriteria = {
        requiredCapabilities: ['quantum-computing'],
        domains: ['physics']
      };

      const badResult = await engine.scoreAgent(testAgent, badCriteria);
      expect(['suitable', 'fallback']).toContain(badResult.recommendation);
    });

    it('should handle agents with no tools', async () => {
      const agentWithoutTools = {
        ...testAgent,
        tools: []
      };

      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing']
      };

      const result = await engine.scoreAgent(agentWithoutTools, criteria);

      expect(result.scoreBreakdown.tools).toBeLessThan(0.5);
      expect(result.score).toBeGreaterThan(0); // Should still have a score
    });

    it('should handle agents with no personality traits', async () => {
      const agentWithoutPersonality = {
        ...testAgent,
        personalityTraits: []
      };

      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing']
      };

      const result = await engine.scoreAgent(agentWithoutPersonality, criteria);

      expect(result.scoreBreakdown.personality).toBe(0.5); // Neutral score
      expect(result.score).toBeGreaterThan(0); // Should still have a score
    });
  });

  describe('explainMatch', () => {
    it('should provide detailed explanation of match', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing'],
        domains: ['testing']
      };

      const result = await engine.scoreAgent(testAgent, criteria);
      const explanation = await engine.explainMatch(result);

      expect(typeof explanation).toBe('string');
      expect(explanation.length).toBeGreaterThan(100);
      expect(explanation).toContain('Agent Match Analysis');
      expect(explanation).toContain('Score Breakdown');
      expect(explanation).toContain('Agent Details');
    });

    it('should include all score components in explanation', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing']
      };

      const result = await engine.scoreAgent(testAgent, criteria);
      const explanation = await engine.explainMatch(result);

      expect(explanation).toContain('Capabilities');
      expect(explanation).toContain('Domain');
      expect(explanation).toContain('Experience');
      expect(explanation).toContain('Personality');
      expect(explanation).toContain('Tools');
    });

    it('should include strengths and concerns if present', async () => {
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing'],
        domains: ['testing']
      };

      const result = await engine.scoreAgent(testAgent, criteria);
      const explanation = await engine.explainMatch(result);

      if (result.matchReasons.length > 0) {
        expect(explanation).toContain('Strengths');
      }
      
      if (result.concerns && result.concerns.length > 0) {
        expect(explanation).toContain('Concerns');
      }
    });
  });

  describe('getMatchingStats', () => {
    it('should provide matching statistics', () => {
      const stats = engine.getMatchingStats();

      expect(stats).toHaveProperty('totalAgents');
      expect(stats).toHaveProperty('domainDistribution');
      expect(stats).toHaveProperty('capabilityDistribution');
      expect(stats).toHaveProperty('averageConfidence');
      
      expect(typeof stats.totalAgents).toBe('number');
      expect(typeof stats.averageConfidence).toBe('number');
      expect(stats.totalAgents).toBeGreaterThan(0);
    });

    it('should show domain distribution', () => {
      const stats = engine.getMatchingStats();

      expect(stats.domainDistribution).toBeDefined();
      expect(typeof stats.domainDistribution).toBe('object');
      expect(stats.domainDistribution['testing']).toBeGreaterThan(0);
    });

    it('should show capability distribution', () => {
      const stats = engine.getMatchingStats();

      expect(stats.capabilityDistribution).toBeDefined();
      expect(typeof stats.capabilityDistribution).toBe('object');
    });
  });

  describe('custom weights', () => {
    it('should use custom weights when provided', async () => {
      const customWeights = {
        capabilities: 0.8,
        domain: 0.1,
        experience: 0.05,
        personality: 0.03,
        tools: 0.02
      };

      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing'],
        weights: customWeights
      };

      const result = await engine.scoreAgent(testAgent, criteria);

      // With high capability weight, capability score should dominate
      const expectedScore = 
        result.scoreBreakdown.capabilities * 0.8 +
        result.scoreBreakdown.domain * 0.1 +
        result.scoreBreakdown.experience * 0.05 +
        result.scoreBreakdown.personality * 0.03 +
        result.scoreBreakdown.tools * 0.02;

      expect(Math.abs(result.score - expectedScore)).toBeLessThan(0.01);
    });
  });

  describe('capability level scoring', () => {
    it('should give higher scores to higher capability levels', async () => {
      // Test agent has 'expert' level unit-testing
      const criteria: AgentMatchingCriteria = {
        requiredCapabilities: ['unit-testing']
      };

      const result = await engine.scoreAgent(testAgent, criteria);

      // Expert level should get a good capability score
      expect(result.scoreBreakdown.capabilities).toBeGreaterThan(0.8);
    });
  });

  describe('related domain scoring', () => {
    it('should give partial scores for related domains', async () => {
      // Create agent in related domain
      const webAgent = registry.get('web-developer');
      if (webAgent) {
        const criteria: AgentMatchingCriteria = {
          domains: ['frontend-development'] // Related to web-development
        };

        const result = await engine.scoreAgent(webAgent, criteria);

        // Should get some domain score for related domain
        expect(result.scoreBreakdown.domain).toBeGreaterThan(0.5);
        expect(result.scoreBreakdown.domain).toBeLessThan(1.0);
      }
    });
  });
});