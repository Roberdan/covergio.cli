/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentFactory } from './AgentFactory.js';
import { AgentLifecycleManager } from './AgentLifecycleManager.js';
import { BaseAgent } from './BaseAgent.js';
import { 
  AgentConfig, 
  AgentRequest, 
  AgentResponse, 
  IAgent,
  AgentState 
} from './types.js';
import {
  IAgentLifecycleManager,
  AgentLifecycleState,
  ResourceLimits
} from './interfaces.js';

// Mock agent for testing
class TestAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async executeTask(request: AgentRequest): Promise<AgentResponse> {
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      type: 'text',
      content: `Test response to: ${request.input}`,
      context: request.context
    };
  }
}

describe('Agent Lifecycle Management', () => {
  let factory: AgentFactory;
  let lifecycleManager: IAgentLifecycleManager;
  let testAgent: IAgent;

  beforeEach(async () => {
    // Create factory with lifecycle management enabled
    factory = new AgentFactory({
      enableMetrics: true,
      enableValidation: true,
      maxConcurrentAgents: 10,
      enableHealthMonitoring: true,
      healthMonitoringInterval: 100, // Fast interval for testing
      resourceLimits: {
        memory: { maxUsage: 256, unit: 'MB' },
        cpu: { maxUsage: 50, unit: 'percent' }
      }
    });

    // Register test agent type
    factory.registerAgentType('test:agent', async (config: AgentConfig) => {
      const agent = new TestAgent(config);
      await agent.initialize();
      return agent;
    });

    // Get lifecycle manager
    lifecycleManager = factory.getAgentLifecycleManager();

    // Create test agent
    testAgent = await factory.createAgent({
      domain: 'test',
      role: 'agent',
      capabilities: ['testing'],
      personalityTraits: [
        { name: 'reliable', value: 0.9, description: 'Highly reliable', category: 'methodical' }
      ]
    });
  });

  afterEach(() => {
    // Clean up
    vi.clearAllTimers();
  });

  describe('AgentLifecycleManager', () => {
    it('should register and track agents', async () => {
      const managedAgents = await lifecycleManager.getManagedAgents();
      
      expect(managedAgents).toHaveLength(1);
      expect(managedAgents[0].agentId).toBe(testAgent.id);
      expect(managedAgents[0].state).toBe('ready');
    });

    it('should get agent lifecycle state', async () => {
      const lifecycleState = await lifecycleManager.getAgentLifecycleState(testAgent.id);
      
      expect(lifecycleState).toBeDefined();
      expect(lifecycleState!.agentId).toBe(testAgent.id);
      expect(lifecycleState!.currentState).toBe('ready');
      expect(lifecycleState!.canPause).toBeTruthy();
      expect(lifecycleState!.canResume).toBeFalsy();
      expect(lifecycleState!.canTerminate).toBeTruthy();
      expect(lifecycleState!.isHealthy).toBeTruthy();
    });

    it('should pause and resume agents', async () => {
      // Test pause
      await lifecycleManager.pauseAgent(testAgent.id);
      expect(testAgent.state).toBe('paused');
      
      const lifecycleState = await lifecycleManager.getAgentLifecycleState(testAgent.id);
      expect(lifecycleState!.canPause).toBeFalsy();
      expect(lifecycleState!.canResume).toBeTruthy();

      // Test resume
      await lifecycleManager.resumeAgent(testAgent.id);
      expect(testAgent.state).toBe('ready');
      
      const resumedState = await lifecycleManager.getAgentLifecycleState(testAgent.id);
      expect(resumedState!.canPause).toBeTruthy();
      expect(resumedState!.canResume).toBeFalsy();
    });

    it('should terminate agents', async () => {
      await lifecycleManager.terminateAgent(testAgent.id);
      expect(testAgent.state).toBe('terminated');
      
      const lifecycleState = await lifecycleManager.getAgentLifecycleState(testAgent.id);
      expect(lifecycleState!.canTerminate).toBeFalsy();
    });

    it('should get agents by state', async () => {
      // Create another agent with the same registered type
      const agent2 = await factory.createAgent({
        domain: 'test',
        role: 'agent'
      });

      // Pause one agent
      await lifecycleManager.pauseAgent(testAgent.id);

      const readyAgents = await lifecycleManager.getAgentsByState('ready');
      const pausedAgents = await lifecycleManager.getAgentsByState('paused');

      expect(readyAgents).toHaveLength(1);
      expect(readyAgents[0].agentId).toBe(agent2.id);
      expect(pausedAgents).toHaveLength(1);
      expect(pausedAgents[0].agentId).toBe(testAgent.id);
    });

    it('should monitor agent health', async () => {
      const healthMetrics = await lifecycleManager.monitorAgent(testAgent.id);
      
      expect(healthMetrics).toBeDefined();
      expect(healthMetrics.status).toBe('healthy');
      expect(healthMetrics.uptime).toBeGreaterThanOrEqual(0);
      expect(healthMetrics.executionCount).toBe(0);
      expect(healthMetrics.errorCount).toBe(0);
      expect(healthMetrics.healthScore).toBeGreaterThan(80);
    });

    it('should track resource usage', async () => {
      const resourceUsage = await lifecycleManager.getResourceUsage(testAgent.id);
      
      expect(resourceUsage).toBeDefined();
      expect(resourceUsage.memory.used).toBeGreaterThanOrEqual(0);
      expect(resourceUsage.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(resourceUsage.executionTime.total).toBeGreaterThanOrEqual(0);
    });

    it('should serialize agent state', async () => {
      const serializedState = await lifecycleManager.serializeAgent(testAgent.id);
      
      expect(serializedState).toBeDefined();
      expect(serializedState.agentId).toBe(testAgent.id);
      expect(serializedState.state).toBe('ready');
      expect(serializedState.version).toBeDefined();
      expect(serializedState.serializedAt).toBeInstanceOf(Date);
    });

    it('should get lifecycle statistics', async () => {
      const stats = await lifecycleManager.getLifecycleStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalAgents).toBe(1);
      expect(stats.activeAgents).toBe(1);
      expect(stats.agentsByState.ready).toBe(1);
      expect(stats.systemHealth.overall).toBe('healthy');
      expect(stats.performance.successRate).toBe(1);
    });

    it('should cleanup terminated agents', async () => {
      // Terminate the agent
      await lifecycleManager.terminateAgent(testAgent.id);
      
      // Cleanup terminated agents
      const cleanedCount = await lifecycleManager.cleanupTerminatedAgents();
      
      expect(cleanedCount).toBe(1);
      
      // Verify agent is no longer managed
      const managedAgents = await lifecycleManager.getManagedAgents();
      expect(managedAgents).toHaveLength(0);
    });

    it('should handle resource limits', async () => {
      const newLimits: ResourceLimits = {
        memory: { maxUsage: 128, unit: 'MB' },
        cpu: { maxUsage: 25, unit: 'percent' },
        storage: { maxUsage: 512, unit: 'MB' },
        executionTime: { maxDuration: 5000, unit: 'milliseconds' },
        concurrency: { maxConcurrentTasks: 3 }
      };

      lifecycleManager.setResourceLimits(newLimits);
      
      const resourceUsage = await lifecycleManager.getResourceUsage(testAgent.id);
      expect(resourceUsage.memory.limit).toBe(128);
      expect(resourceUsage.cpu.limit).toBe(25);
    });

    it('should upgrade agent version', async () => {
      const originalVersion = testAgent.definition.version;
      
      await lifecycleManager.upgradeAgent(testAgent.id, '2.0.0');
      
      expect(testAgent.definition.version).toBe('2.0.0');
      expect(testAgent.definition.version).not.toBe(originalVersion);
    });

    it('should handle invalid operations gracefully', async () => {
      // Try to operate on non-existent agent
      await expect(
        lifecycleManager.pauseAgent('non-existent-agent')
      ).rejects.toThrow('Agent non-existent-agent is not registered');

      // Try to pause already terminated agent
      await lifecycleManager.terminateAgent(testAgent.id);
      await expect(
        lifecycleManager.pauseAgent(testAgent.id)
      ).rejects.toThrow('cannot be paused in current state');
    });

    it('should emit lifecycle events', async () => {
      const events: any[] = [];
      
      lifecycleManager.on('agent-state-changed', (data) => {
        events.push({ type: 'state-changed', data });
      });

      lifecycleManager.on('agent-unhealthy', (data) => {
        events.push({ type: 'unhealthy', data });
      });

      // Trigger state change
      await lifecycleManager.pauseAgent(testAgent.id);
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('state-changed');
      expect(events[0].data.agentId).toBe(testAgent.id);
    });
  });

  describe('BaseAgent Lifecycle Integration', () => {
    it('should implement IAgentLifecycle interface', () => {
      expect(testAgent.getLifecycleState).toBeDefined();
      expect(testAgent.canTransitionTo).toBeDefined();
      expect(testAgent.forceTransition).toBeDefined();
    });

    it('should get lifecycle state from agent', () => {
      const lifecycleState = testAgent.getLifecycleState();
      
      expect(lifecycleState.agentId).toBe(testAgent.id);
      expect(lifecycleState.currentState).toBe('ready');
      expect(lifecycleState.isHealthy).toBeTruthy();
    });

    it('should validate state transitions', () => {
      expect(testAgent.canTransitionTo('paused')).toBeTruthy();
      expect(testAgent.canTransitionTo('busy')).toBeTruthy();
      expect(testAgent.canTransitionTo('terminated')).toBeTruthy();
      expect(testAgent.canTransitionTo('initializing')).toBeFalsy();
    });

    it('should force state transitions', async () => {
      await testAgent.forceTransition('paused');
      expect(testAgent.state).toBe('paused');
      
      await testAgent.forceTransition('ready');
      expect(testAgent.state).toBe('ready');
    });

    it('should track execution and update health', async () => {
      const request: AgentRequest = {
        input: 'test request',
        context: {
          sessionId: 'test-session',
          executionId: 'test-exec',
          timestamp: new Date(),
          environment: {}
        }
      };

      // Execute task
      const response = await testAgent.execute(request);
      
      expect(response.type).toBe('text');
      expect(response.content).toContain('test request');
      
      // Check health after execution
      const health = testAgent.getHealth();
      expect(health.executionCount).toBe(1);
      expect(health.status).toBe('healthy');
    });
  });

  describe('Factory Integration', () => {
    it('should get lifecycle manager from factory', () => {
      const manager = factory.getAgentLifecycleManager();
      
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(AgentLifecycleManager);
    });

    it('should automatically register created agents', async () => {
      const agent2 = await factory.createAgent({
        domain: 'test',
        role: 'agent'
      });

      const managedAgents = await lifecycleManager.getManagedAgents();
      expect(managedAgents.some(a => a.agentId === agent2.id)).toBeTruthy();
    });

    it('should configure lifecycle manager from factory config', () => {
      const customFactory = new AgentFactory({
        enableHealthMonitoring: false,
        healthMonitoringInterval: 5000,
        resourceLimits: {
          memory: { maxUsage: 1024, unit: 'MB' }
        }
      });

      const manager = customFactory.getAgentLifecycleManager();
      expect(manager).toBeDefined();
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track performance metrics over time', async () => {
      const request: AgentRequest = {
        input: 'performance test',
        context: {
          sessionId: 'perf-session',
          executionId: 'perf-exec',
          timestamp: new Date(),
          environment: {}
        }
      };

      // Execute multiple tasks
      for (let i = 0; i < 5; i++) {
        await testAgent.execute(request);
      }

      const health = await lifecycleManager.monitorAgent(testAgent.id);
      expect(health.executionCount).toBe(5);
      expect(health.responseTime.average).toBeGreaterThan(0);
    });

    it('should detect unhealthy agents', async () => {
      let unhealthyEvents = 0;
      
      lifecycleManager.on('agent-unhealthy', () => {
        unhealthyEvents++;
      });

      // Force agent into error state - this will trigger the lifecycle manager's state update
      await testAgent.forceTransition('error');
      
      // Wait for health monitoring to detect
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const lifecycleState = await lifecycleManager.getAgentLifecycleState(testAgent.id);
      expect(lifecycleState!.isHealthy).toBeFalsy();
    });

    it('should calculate health scores correctly', async () => {
      const healthMetrics = await lifecycleManager.monitorAgent(testAgent.id);
      
      // Healthy agent should have high score
      expect(healthMetrics.healthScore).toBeGreaterThan(80);
      
      // Force errors and check score degradation
      await testAgent.forceTransition('error');
      const unhealthyMetrics = await lifecycleManager.monitorAgent(testAgent.id);
      expect(unhealthyMetrics.healthScore).toBeLessThan(healthMetrics.healthScore);
    });
  });

  describe('Resource Management', () => {
    it('should track memory usage', async () => {
      const initialUsage = await lifecycleManager.getResourceUsage(testAgent.id);
      
      // Execute some tasks to increase memory usage (simulated)
      const request: AgentRequest = {
        input: 'memory test',
        context: {
          sessionId: 'mem-session',
          executionId: 'mem-exec',
          timestamp: new Date(),
          environment: {}
        }
      };
      
      await testAgent.execute(request);
      
      const afterUsage = await lifecycleManager.getResourceUsage(testAgent.id);
      expect(afterUsage.executionTime.total).toBeGreaterThan(initialUsage.executionTime.total);
    });

    it('should enforce resource limits', () => {
      const strictLimits: ResourceLimits = {
        memory: { maxUsage: 64, unit: 'MB' },
        cpu: { maxUsage: 10, unit: 'percent' },
        storage: { maxUsage: 128, unit: 'MB' },
        executionTime: { maxDuration: 1000, unit: 'milliseconds' },
        concurrency: { maxConcurrentTasks: 1 }
      };

      lifecycleManager.setResourceLimits(strictLimits);
      
      // Resource limits should be applied to new resource calculations
      expect(() => lifecycleManager.setResourceLimits(strictLimits)).not.toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle agent errors gracefully', async () => {
      // Create a failing request
      const request: AgentRequest = {
        input: '', // Invalid empty input
        context: {
          sessionId: 'error-session',
          executionId: 'error-exec',
          timestamp: new Date(),
          environment: {}
        }
      };

      const response = await testAgent.execute(request);
      expect(response.type).toBe('error');
      
      const health = testAgent.getHealth();
      expect(health.errorCount).toBe(1);
    });

    it('should recover from error states', async () => {
      // Force error state
      await testAgent.forceTransition('error');
      expect(testAgent.state).toBe('error');
      
      // Force recovery
      await testAgent.forceTransition('ready');
      expect(testAgent.state).toBe('ready');
    });

    it('should handle lifecycle manager errors', async () => {
      // Unregister agent and try to operate on it
      await lifecycleManager.unregisterAgent(testAgent.id);
      
      await expect(
        lifecycleManager.getAgentLifecycleState(testAgent.id)
      ).resolves.toBeNull();
    });
  });
});