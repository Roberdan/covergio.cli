/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SmartWorkflowPlanner } from './SmartWorkflowPlanner.js';
import { PlanningContext, PlanningConstraints } from '../interfaces/IWorkflowPlanner.js';
import { AgentInstance } from '../../types/common.js';
import { RequestAnalysis } from '../../interfaces/IRequestHandler.js';
import { OrchestrationRequest } from '../../interfaces/IOrchestrator.js';

describe('SmartWorkflowPlanner', () => {
  let planner: SmartWorkflowPlanner;
  let mockRequest: OrchestrationRequest;
  let mockConstraints: PlanningConstraints;
  let mockAgents: AgentInstance[];

  beforeEach(() => {
    planner = new SmartWorkflowPlanner();

    mockRequest = {
      id: 'test-request',
      userInput: 'Create a TypeScript function with tests',
      sessionContext: {
        sessionId: 'test-session',
        workspaceRoot: '/test',
        timestamp: new Date(),
        metadata: {},
      },
      timestamp: new Date(),
    };

    mockConstraints = {
      maxSteps: 10,
      maxDuration: 600000,
      allowedAgentTypes: ['gemini', 'task-master', 'analysis'],
      requireApproval: false,
      budget: {
        maxCost: 100,
        costPerMinute: 1,
      },
    };

    mockAgents = [
      {
        id: 'gemini-agent',
        type: 'gemini',
        capabilities: [
          { name: 'text-generation', version: '1.0.0', enabled: true },
          { name: 'code-assistance', version: '1.0.0', enabled: true },
        ],
        status: 'idle',
        configuration: {},
        performance: {
          successRate: 0.95,
          averageResponseTime: 2000,
          tasksCompleted: 10,
        },
      },
      {
        id: 'analysis-agent',
        type: 'analysis',
        capabilities: [
          { name: 'analysis', version: '1.0.0', enabled: true },
          { name: 'quality-assurance', version: '1.0.0', enabled: true },
        ],
        status: 'idle',
        configuration: {},
        performance: {
          successRate: 0.90,
          averageResponseTime: 1500,
          tasksCompleted: 15,
        },
      },
    ];
  });

  describe('plan creation', () => {
    it('should create a plan for code generation', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'medium',
        intent: 'create typescript function',
        domains: ['code-generation'],
        requiredCapabilities: ['text-generation', 'code-assistance'],
        estimatedDuration: 300000,
        priority: 'medium',
        metadata: {},
      };

      const context: PlanningContext = {
        request: mockRequest,
        analysis,
        availableAgents: mockAgents,
        constraints: mockConstraints,
      };

      const result = await planner.createPlan(context);

      expect(result.plan).toBeDefined();
      expect(result.plan.steps.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.plan.name).toContain('Code Generation');
    });

    it('should create a plan for documentation', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'simple',
        intent: 'create documentation',
        domains: ['documentation'],
        requiredCapabilities: ['text-generation', 'content-creation'],
        estimatedDuration: 240000,
        priority: 'low',
        metadata: {},
      };

      const context: PlanningContext = {
        request: { ...mockRequest, userInput: 'Create API documentation' },
        analysis,
        availableAgents: mockAgents,
        constraints: mockConstraints,
      };

      const result = await planner.createPlan(context);

      expect(result.plan.name).toContain('Documentation');
      expect(result.plan.steps.some(step => step.type === 'generation')).toBe(true);
    });

    it('should create a plan for testing', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'medium',
        intent: 'create tests',
        domains: ['testing'],
        requiredCapabilities: ['code-assistance', 'quality-assurance'],
        estimatedDuration: 180000,
        priority: 'high',
        metadata: {},
      };

      const context: PlanningContext = {
        request: { ...mockRequest, userInput: 'Create unit tests' },
        analysis,
        availableAgents: mockAgents,
        constraints: mockConstraints,
      };

      const result = await planner.createPlan(context);

      expect(result.plan.name).toContain('Testing');
      expect(result.plan.steps.some(step => step.type === 'testing')).toBe(true);
    });

    it('should handle general requests', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'simple',
        intent: 'general request',
        domains: ['general'],
        requiredCapabilities: ['text-generation'],
        estimatedDuration: 60000,
        priority: 'medium',
        metadata: {},
      };

      const context: PlanningContext = {
        request: { ...mockRequest, userInput: 'Help with something' },
        analysis,
        availableAgents: mockAgents,
        constraints: mockConstraints,
      };

      const result = await planner.createPlan(context);

      expect(result.plan.name).toContain('General');
      expect(result.plan.steps).toHaveLength(1);
      expect(result.plan.steps[0].type).toBe('general');
    });
  });

  describe('plan optimization', () => {
    it('should optimize a simple plan', async () => {
      const originalPlan = {
        id: 'test-plan',
        name: 'Test Plan',
        description: 'Test description',
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            type: 'analysis',
            description: 'Analyze',
            estimatedDuration: 60000,
            dependencies: [],
            parallel: false,
            configuration: {
              action: 'analyze',
              requiredCapabilities: ['analysis'],
            },
          },
          {
            id: 'step-2',
            name: 'Step 2',
            type: 'generation',
            description: 'Generate',
            estimatedDuration: 120000,
            dependencies: ['step-1'],
            parallel: false,
            configuration: {
              action: 'generate',
              requiredCapabilities: ['text-generation'],
            },
          },
        ],
        estimatedTotalDuration: 180000,
        priority: 'medium' as const,
        metadata: {},
      };

      const optimizedPlan = await planner.optimizePlan(originalPlan, mockConstraints);

      expect(optimizedPlan).toBeDefined();
      expect(optimizedPlan.steps.length).toBeGreaterThan(0);
    });

    it('should handle parallel execution optimization', async () => {
      const planWithParallelSteps = {
        id: 'parallel-plan',
        name: 'Parallel Plan',
        description: 'Plan with parallel steps',
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            type: 'analysis',
            description: 'Analyze',
            estimatedDuration: 60000,
            dependencies: [],
            parallel: false,
            configuration: {
              action: 'analyze',
              requiredCapabilities: ['analysis'],
            },
          },
          {
            id: 'step-2',
            name: 'Step 2',
            type: 'generation',
            description: 'Generate code',
            estimatedDuration: 120000,
            dependencies: ['step-1'],
            parallel: false,
            configuration: {
              action: 'generate',
              requiredCapabilities: ['text-generation'],
            },
          },
          {
            id: 'step-3',
            name: 'Step 3',
            type: 'testing',
            description: 'Generate tests',
            estimatedDuration: 90000,
            dependencies: ['step-1'],
            parallel: false,
            configuration: {
              action: 'test',
              requiredCapabilities: ['quality-assurance'],
            },
          },
        ],
        estimatedTotalDuration: 270000,
        priority: 'medium' as const,
        metadata: {},
      };

      const optimizedPlan = await planner.optimizePlan(planWithParallelSteps, mockConstraints);

      expect(optimizedPlan).toBeDefined();
      // Should optimize for parallel execution where possible
      expect(optimizedPlan.steps.some(step => step.parallel)).toBe(true);
    });
  });

  describe('plan validation', () => {
    it('should validate a correct plan', async () => {
      const validPlan = {
        id: 'valid-plan',
        name: 'Valid Plan',
        description: 'A valid plan',
        steps: [
          {
            id: 'step-1',
            name: 'Valid Step',
            type: 'analysis',
            description: 'Valid step',
            estimatedDuration: 60000,
            dependencies: [],
            parallel: false,
            configuration: {
              action: 'analyze',
              requiredCapabilities: ['analysis'],
            },
          },
        ],
        estimatedTotalDuration: 60000,
        priority: 'medium' as const,
        metadata: {},
      };

      const result = await planner.validatePlan(validPlan, mockAgents);

      expect(result.isValid).toBe(true);
      expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    it('should detect dependency errors', async () => {
      const invalidPlan = {
        id: 'invalid-plan',
        name: 'Invalid Plan',
        description: 'Plan with invalid dependencies',
        steps: [
          {
            id: 'step-1',
            name: 'Step with invalid dependency',
            type: 'analysis',
            description: 'Step',
            estimatedDuration: 60000,
            dependencies: ['non-existent-step'],
            parallel: false,
            configuration: {
              action: 'analyze',
              requiredCapabilities: ['analysis'],
            },
          },
        ],
        estimatedTotalDuration: 60000,
        priority: 'medium' as const,
        metadata: {},
      };

      const result = await planner.validatePlan(invalidPlan, mockAgents);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Dependency'))).toBe(true);
    });

    it('should detect missing agent capabilities', async () => {
      const planWithMissingCapabilities = {
        id: 'missing-caps-plan',
        name: 'Plan with Missing Capabilities',
        description: 'Plan requiring unavailable capabilities',
        steps: [
          {
            id: 'step-1',
            name: 'Step requiring unavailable capability',
            type: 'special',
            description: 'Special step',
            estimatedDuration: 60000,
            dependencies: [],
            parallel: false,
            configuration: {
              action: 'special-action',
              requiredCapabilities: ['non-existent-capability'],
            },
          },
        ],
        estimatedTotalDuration: 60000,
        priority: 'medium' as const,
        metadata: {},
      };

      const result = await planner.validatePlan(planWithMissingCapabilities, mockAgents);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('No agents available'))).toBe(true);
    });

    it('should detect missing step configuration', async () => {
      const planWithMissingConfig = {
        id: 'missing-config-plan',
        name: 'Plan with Missing Config',
        description: 'Plan with incomplete step configuration',
        steps: [
          {
            id: 'step-1',
            name: 'Incomplete Step',
            type: 'incomplete',
            description: 'Step without action',
            estimatedDuration: 60000,
            dependencies: [],
            parallel: false,
            configuration: {
              requiredCapabilities: ['analysis'],
              // Missing action
            },
          },
        ],
        estimatedTotalDuration: 60000,
        priority: 'medium' as const,
        metadata: {},
      };

      const result = await planner.validatePlan(planWithMissingConfig, mockAgents);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('missing required action'))).toBe(true);
    });
  });

  describe('planner capabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = planner.getCapabilities();

      expect(capabilities.supportedComplexity).toContain('simple');
      expect(capabilities.supportedComplexity).toContain('medium');
      expect(capabilities.supportedComplexity).toContain('complex');
      expect(capabilities.supportedDomains).toContain('code-generation');
      expect(capabilities.maxStepsSupported).toBeGreaterThan(0);
      expect(capabilities.supportsParallelExecution).toBe(true);
      expect(capabilities.supportsRollback).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle empty agent list', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'simple',
        intent: 'test with no agents',
        domains: ['code-generation'],
        requiredCapabilities: ['text-generation'],
        estimatedDuration: 60000,
        priority: 'medium',
        metadata: {},
      };

      const context: PlanningContext = {
        request: mockRequest,
        analysis,
        availableAgents: [], // No agents available
        constraints: mockConstraints,
      };

      const result = await planner.createPlan(context);

      expect(result.plan).toBeDefined();
      expect(result.confidence).toBe(0); // Should have zero confidence with no agents
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle constraint violations', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'complex',
        intent: 'complex task',
        domains: ['code-generation'],
        requiredCapabilities: ['text-generation'],
        estimatedDuration: 60000,
        priority: 'medium',
        metadata: {},
      };

      const restrictiveConstraints: PlanningConstraints = {
        maxSteps: 1, // Very restrictive
        maxDuration: 1000, // Very short
        allowedAgentTypes: ['gemini'],
        requireApproval: false,
      };

      const context: PlanningContext = {
        request: mockRequest,
        analysis,
        availableAgents: mockAgents,
        constraints: restrictiveConstraints,
      };

      const result = await planner.createPlan(context);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});