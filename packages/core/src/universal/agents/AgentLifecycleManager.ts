/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { IAgent, AgentState } from './types.js';
import {
  IAgentLifecycleManager,
  AgentLifecycleState,
  StateTransition,
  AgentLifecycleInfo,
  AgentHealthMetrics,
  ResourceUsageMetrics,
  ResourceLimits,
  SerializedAgentState,
  LifecycleStatistics,
  HealthAlert
} from './interfaces.js';

/**
 * Agent lifecycle manager implementation
 */
export class AgentLifecycleManager extends EventEmitter implements IAgentLifecycleManager {
  private managedAgents = new Map<string, IAgent>();
  private lifecycleStates = new Map<string, AgentLifecycleState>();
  private resourceLimits: ResourceLimits;
  private healthMonitoringEnabled = true;
  private healthMonitoringInterval = 30000; // 30 seconds
  private healthMonitoringTimer: NodeJS.Timeout | null = null;
  private performanceMetrics = new Map<string, PerformanceTracker>();

  constructor(config?: AgentLifecycleManagerConfig) {
    super();

    // Set default resource limits
    this.resourceLimits = {
      memory: { maxUsage: 512, unit: 'MB' },
      cpu: { maxUsage: 80, unit: 'percent' },
      storage: { maxUsage: 1024, unit: 'MB' },
      executionTime: { maxDuration: 300000, unit: 'milliseconds' },
      concurrency: { maxConcurrentTasks: 5 }
    };

    if (config?.resourceLimits) {
      this.resourceLimits = { ...this.resourceLimits, ...config.resourceLimits };
    }

    this.startHealthMonitoring();
  }

  /**
   * Register an agent for lifecycle management
   */
  async registerAgent(agent: IAgent): Promise<void> {
    const agentId = agent.id;
    
    if (this.managedAgents.has(agentId)) {
      throw new Error(`Agent ${agentId} is already registered`);
    }

    this.managedAgents.set(agentId, agent);
    
    // Initialize lifecycle state
    const lifecycleState: AgentLifecycleState = {
      agentId,
      currentState: agent.state,
      previousState: null,
      stateHistory: [],
      uptime: 0,
      lastStateChange: new Date(),
      isHealthy: true,
      canPause: agent.state === 'ready' || agent.state === 'busy',
      canResume: agent.state === 'paused',
      canTerminate: agent.state !== 'terminated',
      metadata: {}
    };

    this.lifecycleStates.set(agentId, lifecycleState);
    
    // Initialize performance tracking
    this.performanceMetrics.set(agentId, new PerformanceTracker());

    // Set up event listeners for the agent
    this.setupAgentEventListeners(agent);

    this.emit('agent-registered', { agentId, agent });
  }

  /**
   * Unregister an agent from lifecycle management
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.managedAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    // Terminate agent if not already terminated
    if (agent.state !== 'terminated') {
      await this.terminateAgent(agentId);
    }

    this.managedAgents.delete(agentId);
    this.lifecycleStates.delete(agentId);
    this.performanceMetrics.delete(agentId);

    this.emit('agent-unregistered', { agentId });
  }

  /**
   * Get lifecycle state for an agent
   */
  async getAgentLifecycleState(agentId: string): Promise<AgentLifecycleState | null> {
    const state = this.lifecycleStates.get(agentId);
    if (!state) {
      return null;
    }

    // Update uptime
    state.uptime = Date.now() - state.lastStateChange.getTime();
    
    return { ...state };
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId: string): Promise<void> {
    const agent = this.managedAgents.get(agentId);
    const lifecycleState = this.lifecycleStates.get(agentId);
    
    if (!agent || !lifecycleState) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    if (!lifecycleState.canPause) {
      throw new Error(`Agent ${agentId} cannot be paused in current state: ${agent.state}`);
    }

    await agent.pause();
    this.updateAgentState(agentId, agent.state, 'Manual pause request');
  }

  /**
   * Resume an agent
   */
  async resumeAgent(agentId: string): Promise<void> {
    const agent = this.managedAgents.get(agentId);
    const lifecycleState = this.lifecycleStates.get(agentId);
    
    if (!agent || !lifecycleState) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    if (!lifecycleState.canResume) {
      throw new Error(`Agent ${agentId} cannot be resumed in current state: ${agent.state}`);
    }

    await agent.resume();
    this.updateAgentState(agentId, agent.state, 'Manual resume request');
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: string): Promise<void> {
    const agent = this.managedAgents.get(agentId);
    const lifecycleState = this.lifecycleStates.get(agentId);
    
    if (!agent || !lifecycleState) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    if (!lifecycleState.canTerminate) {
      throw new Error(`Agent ${agentId} cannot be terminated in current state: ${agent.state}`);
    }

    await agent.terminate();
    this.updateAgentState(agentId, agent.state, 'Manual termination request');
  }

  /**
   * Get all managed agents
   */
  async getManagedAgents(): Promise<AgentLifecycleInfo[]> {
    const agents: AgentLifecycleInfo[] = [];

    for (const [agentId, agent] of this.managedAgents) {
      const lifecycleState = this.lifecycleStates.get(agentId);
      if (lifecycleState) {
        agents.push({
          agentId,
          definition: {
            domain: agent.definition.domain,
            role: agent.definition.role,
            version: agent.definition.version
          },
          state: agent.state,
          health: await this.calculateHealthMetrics(agentId),
          resources: await this.calculateResourceUsage(agentId),
          uptime: Date.now() - lifecycleState.lastStateChange.getTime(),
          createdAt: agent.definition.createdAt,
          lastActivity: new Date(), // Would come from agent metrics
          metadata: lifecycleState.metadata
        });
      }
    }

    return agents;
  }

  /**
   * Get agents by state
   */
  async getAgentsByState(state: AgentState): Promise<AgentLifecycleInfo[]> {
    const allAgents = await this.getManagedAgents();
    return allAgents.filter(agent => agent.state === state);
  }

  /**
   * Serialize agent state for persistence
   */
  async serializeAgent(agentId: string): Promise<SerializedAgentState> {
    const agent = this.managedAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    const agentSerialized = await agent.serialize();
    const lifecycleState = this.lifecycleStates.get(agentId);
    const performanceTracker = this.performanceMetrics.get(agentId);

    return {
      agentId,
      definition: agent.definition,
      config: JSON.parse(agentSerialized), // Assuming agent.serialize() returns JSON
      state: agent.state,
      memory: agentSerialized,
      personalityState: {},
      capabilityStates: {},
      executionStats: {
        executionCount: performanceTracker?.executionCount || 0,
        errorCount: performanceTracker?.errorCount || 0,
        startTime: agent.definition.createdAt,
        lastActivity: new Date()
      },
      metadata: lifecycleState?.metadata || {},
      version: agent.definition.version,
      serializedAt: new Date()
    };
  }

  /**
   * Deserialize and restore agent state
   */
  async deserializeAgent(serializedState: SerializedAgentState): Promise<IAgent> {
    throw new Error('Deserialize agent not implemented - requires agent factory integration');
  }

  /**
   * Monitor agent health and performance
   */
  async monitorAgent(agentId: string): Promise<AgentHealthMetrics> {
    const agent = this.managedAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    return this.calculateHealthMetrics(agentId);
  }

  /**
   * Get resource usage for an agent
   */
  async getResourceUsage(agentId: string): Promise<ResourceUsageMetrics> {
    const agent = this.managedAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    return this.calculateResourceUsage(agentId);
  }

  /**
   * Cleanup terminated agents
   */
  async cleanupTerminatedAgents(): Promise<number> {
    const terminatedAgents = Array.from(this.managedAgents.entries())
      .filter(([_, agent]) => agent.state === 'terminated');

    for (const [agentId, _] of terminatedAgents) {
      await this.unregisterAgent(agentId);
    }

    return terminatedAgents.length;
  }

  /**
   * Get lifecycle statistics
   */
  async getLifecycleStatistics(): Promise<LifecycleStatistics> {
    const allAgents = await this.getManagedAgents();
    
    const agentsByState = allAgents.reduce((acc, agent) => {
      acc[agent.state] = (acc[agent.state] || 0) + 1;
      return acc;
    }, {} as Record<AgentState, number>);

    const totalExecutions = allAgents.reduce((sum, agent) => sum + agent.health.executionCount, 0);
    const totalUptime = allAgents.reduce((sum, agent) => sum + agent.uptime, 0);
    const averageUptime = allAgents.length > 0 ? totalUptime / allAgents.length : 0;

    const healthyAgents = allAgents.filter(agent => agent.health.status === 'healthy').length;
    const degradedAgents = allAgents.filter(agent => agent.health.status === 'degraded').length;
    const unhealthyAgents = allAgents.filter(agent => agent.health.status === 'unhealthy').length;

    const overallHealth = unhealthyAgents > 0 ? 'unhealthy' : 
                         degradedAgents > 0 ? 'degraded' : 'healthy';

    const averageResponseTime = allAgents.length > 0 ? 
      allAgents.reduce((sum, agent) => sum + agent.health.responseTime.average, 0) / allAgents.length : 0;

    const totalErrorCount = allAgents.reduce((sum, agent) => sum + agent.health.errorCount, 0);
    const errorRate = totalExecutions > 0 ? totalErrorCount / totalExecutions : 0;

    return {
      totalAgents: allAgents.length,
      activeAgents: agentsByState.ready || 0,
      pausedAgents: agentsByState.paused || 0,
      terminatedAgents: agentsByState.terminated || 0,
      erroredAgents: agentsByState.error || 0,
      agentsByState,
      averageUptime,
      totalExecutions,
      averageResponseTime,
      systemHealth: {
        overall: overallHealth,
        score: healthyAgents / Math.max(allAgents.length, 1) * 100,
        alerts: allAgents.reduce((sum, agent) => sum + agent.health.alerts.length, 0)
      },
      resourceUtilization: {
        memory: allAgents.reduce((sum, agent) => sum + agent.resources.memory.used, 0),
        cpu: allAgents.reduce((sum, agent) => sum + agent.resources.cpu.usage, 0) / Math.max(allAgents.length, 1),
        storage: allAgents.reduce((sum, agent) => sum + agent.resources.storage.used, 0)
      },
      performance: {
        throughput: totalExecutions,
        errorRate,
        successRate: 1 - errorRate
      }
    };
  }

  /**
   * Enable/disable automatic health monitoring
   */
  setHealthMonitoring(enabled: boolean, intervalMs?: number): void {
    this.healthMonitoringEnabled = enabled;
    
    if (intervalMs) {
      this.healthMonitoringInterval = intervalMs;
    }

    if (enabled) {
      this.startHealthMonitoring();
    } else {
      this.stopHealthMonitoring();
    }
  }

  /**
   * Set resource limits for agents
   */
  setResourceLimits(limits: ResourceLimits): void {
    this.resourceLimits = { ...this.resourceLimits, ...limits };
  }

  /**
   * Upgrade agent to new version
   */
  async upgradeAgent(agentId: string, newVersion: string): Promise<void> {
    const agent = this.managedAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    // Serialize current state
    const serializedState = await this.serializeAgent(agentId);
    
    // Update version
    agent.definition.version = newVersion;
    agent.definition.updatedAt = new Date();

    // Update lifecycle state
    const lifecycleState = this.lifecycleStates.get(agentId);
    if (lifecycleState) {
      lifecycleState.metadata.lastUpgrade = new Date();
      lifecycleState.metadata.previousVersion = serializedState.version;
    }

    this.emit('agent-upgraded', { agentId, newVersion, previousVersion: serializedState.version });
  }

  /**
   * Update agent state and history
   */
  private updateAgentState(agentId: string, newState: AgentState, reason: string): void {
    const lifecycleState = this.lifecycleStates.get(agentId);
    if (!lifecycleState) {
      return;
    }

    const transition: StateTransition = {
      fromState: lifecycleState.currentState,
      toState: newState,
      timestamp: new Date(),
      reason
    };

    lifecycleState.previousState = lifecycleState.currentState;
    lifecycleState.currentState = newState;
    lifecycleState.stateHistory.push(transition);
    lifecycleState.lastStateChange = new Date();

    // Update capabilities
    lifecycleState.canPause = newState === 'ready' || newState === 'busy';
    lifecycleState.canResume = newState === 'paused';
    lifecycleState.canTerminate = newState !== 'terminated';

    // Update health status
    lifecycleState.isHealthy = newState !== 'error' && newState !== 'terminated';

    this.emit('agent-state-changed', { agentId, transition });
  }

  /**
   * Set up event listeners for an agent
   */
  private setupAgentEventListeners(agent: IAgent): void {
    agent.on('state-changed', (data) => {
      this.updateAgentState(agent.id, data.newState, 'Agent state change');
    });

    agent.on('execution-started', (data) => {
      const tracker = this.performanceMetrics.get(agent.id);
      if (tracker) {
        tracker.recordExecutionStart();
      }
    });

    agent.on('execution-completed', (data) => {
      const tracker = this.performanceMetrics.get(agent.id);
      if (tracker) {
        tracker.recordExecutionComplete(data.response?.executionTime || 0);
      }
    });

    agent.on('execution-failed', (data) => {
      const tracker = this.performanceMetrics.get(agent.id);
      if (tracker) {
        tracker.recordExecutionError();
      }
    });
  }

  /**
   * Calculate health metrics for an agent
   */
  private async calculateHealthMetrics(agentId: string): Promise<AgentHealthMetrics> {
    const agent = this.managedAgents.get(agentId);
    const lifecycleState = this.lifecycleStates.get(agentId);
    const performanceTracker = this.performanceMetrics.get(agentId);

    if (!agent || !lifecycleState || !performanceTracker) {
      return this.getDefaultHealthMetrics();
    }

    const health = agent.getHealth();
    const alerts: HealthAlert[] = [];

    // Check for health alerts
    if (health.errorCount > 10) {
      alerts.push({
        level: 'warning',
        message: `High error count: ${health.errorCount}`,
        timestamp: new Date(),
        metric: 'errorCount',
        value: health.errorCount,
        threshold: 10
      });
    }

    if (health.memoryUsage > 1000) {
      alerts.push({
        level: 'error',
        message: `High memory usage: ${health.memoryUsage}MB`,
        timestamp: new Date(),
        metric: 'memoryUsage',
        value: health.memoryUsage,
        threshold: 1000
      });
    }

    const successRate = health.executionCount > 0 ? 
      (health.executionCount - health.errorCount) / health.executionCount : 1;

    return {
      status: health.status,
      uptime: health.uptime,
      memoryUsage: health.memoryUsage,
      cpuUsage: Math.random() * 50, // Simulated CPU usage
      executionCount: health.executionCount,
      successRate,
      errorCount: health.errorCount,
      lastError: null,
      lastActivity: health.lastActivity,
      responseTime: {
        average: performanceTracker.getAverageResponseTime(),
        median: performanceTracker.getMedianResponseTime(),
        percentile95: performanceTracker.getPercentile95ResponseTime()
      },
      healthScore: this.calculateHealthScore(health, alerts),
      alerts
    };
  }

  /**
   * Calculate resource usage for an agent
   */
  private async calculateResourceUsage(agentId: string): Promise<ResourceUsageMetrics> {
    const agent = this.managedAgents.get(agentId);
    const performanceTracker = this.performanceMetrics.get(agentId);

    if (!agent || !performanceTracker) {
      return this.getDefaultResourceUsage();
    }

    const health = agent.getHealth();

    return {
      memory: {
        used: health.memoryUsage,
        peak: performanceTracker.peakMemoryUsage,
        limit: this.resourceLimits.memory.maxUsage,
        unit: this.resourceLimits.memory.unit
      },
      cpu: {
        usage: Math.random() * 30, // Simulated CPU usage
        peak: performanceTracker.peakCpuUsage,
        limit: this.resourceLimits.cpu.maxUsage,
        unit: this.resourceLimits.cpu.unit
      },
      storage: {
        used: Math.random() * 100, // Simulated storage usage
        limit: this.resourceLimits.storage.maxUsage,
        unit: this.resourceLimits.storage.unit
      },
      network: {
        bytesIn: performanceTracker.networkBytesIn,
        bytesOut: performanceTracker.networkBytesOut,
        connections: 1
      },
      executionTime: {
        total: performanceTracker.totalExecutionTime,
        average: performanceTracker.getAverageResponseTime(),
        peak: performanceTracker.peakExecutionTime,
        unit: 'milliseconds'
      }
    };
  }

  /**
   * Calculate health score (0-100)
   */
  private calculateHealthScore(health: any, alerts: HealthAlert[]): number {
    let score = 100;

    // Deduct for errors
    if (health.errorCount > 0) {
      score -= Math.min(health.errorCount * 2, 30);
    }

    // Deduct for alerts
    alerts.forEach(alert => {
      switch (alert.level) {
        case 'critical':
          score -= 25;
          break;
        case 'error':
          score -= 15;
          break;
        case 'warning':
          score -= 5;
          break;
      }
    });

    // Deduct for unhealthy states
    if (health.status === 'unhealthy') {
      score -= 40;
    } else if (health.status === 'degraded') {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (!this.healthMonitoringEnabled || this.healthMonitoringTimer) {
      return;
    }

    this.healthMonitoringTimer = setInterval(async () => {
      for (const agentId of this.managedAgents.keys()) {
        try {
          const health = await this.calculateHealthMetrics(agentId);
          const lifecycleState = this.lifecycleStates.get(agentId);
          
          if (lifecycleState) {
            lifecycleState.isHealthy = health.status === 'healthy';
            
            if (health.status === 'unhealthy') {
              this.emit('agent-unhealthy', { agentId, health });
            }
          }
        } catch (error) {
          console.error(`Error monitoring agent ${agentId}:`, error);
        }
      }
    }, this.healthMonitoringInterval);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthMonitoringTimer) {
      clearInterval(this.healthMonitoringTimer);
      this.healthMonitoringTimer = null;
    }
  }

  /**
   * Get default health metrics
   */
  private getDefaultHealthMetrics(): AgentHealthMetrics {
    return {
      status: 'unknown',
      uptime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      executionCount: 0,
      successRate: 0,
      errorCount: 0,
      lastError: null,
      lastActivity: new Date(),
      responseTime: {
        average: 0,
        median: 0,
        percentile95: 0
      },
      healthScore: 0,
      alerts: []
    };
  }

  /**
   * Get default resource usage
   */
  private getDefaultResourceUsage(): ResourceUsageMetrics {
    return {
      memory: {
        used: 0,
        peak: 0,
        limit: this.resourceLimits.memory.maxUsage,
        unit: this.resourceLimits.memory.unit
      },
      cpu: {
        usage: 0,
        peak: 0,
        limit: this.resourceLimits.cpu.maxUsage,
        unit: this.resourceLimits.cpu.unit
      },
      storage: {
        used: 0,
        limit: this.resourceLimits.storage.maxUsage,
        unit: this.resourceLimits.storage.unit
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        connections: 0
      },
      executionTime: {
        total: 0,
        average: 0,
        peak: 0,
        unit: 'milliseconds'
      }
    };
  }
}

/**
 * Performance tracker for agents
 */
class PerformanceTracker {
  public executionCount = 0;
  public errorCount = 0;
  public totalExecutionTime = 0;
  public peakExecutionTime = 0;
  public peakMemoryUsage = 0;
  public peakCpuUsage = 0;
  public networkBytesIn = 0;
  public networkBytesOut = 0;
  
  private responseTimesMs: number[] = [];
  private currentExecutionStart: number = 0;

  recordExecutionStart(): void {
    this.currentExecutionStart = Date.now();
  }

  recordExecutionComplete(executionTime: number): void {
    this.executionCount++;
    this.totalExecutionTime += executionTime;
    this.peakExecutionTime = Math.max(this.peakExecutionTime, executionTime);
    
    this.responseTimesMs.push(executionTime);
    
    // Keep only last 100 response times
    if (this.responseTimesMs.length > 100) {
      this.responseTimesMs.shift();
    }
  }

  recordExecutionError(): void {
    this.errorCount++;
    this.executionCount++;
  }

  getAverageResponseTime(): number {
    if (this.responseTimesMs.length === 0) return 0;
    return this.responseTimesMs.reduce((sum, time) => sum + time, 0) / this.responseTimesMs.length;
  }

  getMedianResponseTime(): number {
    if (this.responseTimesMs.length === 0) return 0;
    const sorted = [...this.responseTimesMs].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  }

  getPercentile95ResponseTime(): number {
    if (this.responseTimesMs.length === 0) return 0;
    const sorted = [...this.responseTimesMs].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }
}

/**
 * Configuration for AgentLifecycleManager
 */
export interface AgentLifecycleManagerConfig {
  resourceLimits?: Partial<ResourceLimits>;
  healthMonitoringInterval?: number;
  enableHealthMonitoring?: boolean;
}

/**
 * Lifecycle manager events
 */
export interface AgentLifecycleManagerEvents {
  'agent-registered': { agentId: string; agent: IAgent };
  'agent-unregistered': { agentId: string };
  'agent-state-changed': { agentId: string; transition: StateTransition };
  'agent-unhealthy': { agentId: string; health: AgentHealthMetrics };
  'agent-upgraded': { agentId: string; newVersion: string; previousVersion: string };
}

/**
 * Type the EventEmitter properly
 */
export interface AgentLifecycleManager {
  on<K extends keyof AgentLifecycleManagerEvents>(event: K, listener: (data: AgentLifecycleManagerEvents[K]) => void): this;
  emit<K extends keyof AgentLifecycleManagerEvents>(event: K, data: AgentLifecycleManagerEvents[K]): boolean;
}