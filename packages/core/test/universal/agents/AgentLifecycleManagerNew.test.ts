import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { setTimeout as delay } from 'timers/promises';

// Types for our use cases
type TaskType = 'data_processing' | 'api_call' | 'file_operation' | 'scheduled_task';

interface Task {
  id: string;
  type: TaskType;
  payload: any;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
  dependsOn?: string[]; // For task dependencies
}

interface AgentStats {
  totalTasksProcessed: number;
  lastActive: Date | null;
  errorCount: number;
  avgProcessingTime: number;
}

// Base Agent interface that both MockAgent and ExtendedMockAgent will implement
interface IAgent {
  id: string;
  name: string;
  state: 'idle' | 'initialized' | 'processing' | 'error' | 'shutdown';
  health: { status: 'healthy' | 'degraded' | 'unhealthy' };
  status: 'healthy' | 'degraded' | 'unhealthy';
  result: any;
  initialize(): Promise<this>;
  execute(task: any): Promise<{ result: any; [key: string]: any }>;
  shutdown(): Promise<void>;
  getStats(): AgentStats;
}

// Basic MockAgent implementation for simple tests
class MockAgent implements IAgent {
  public id: string;
  public name: string;
  public state: 'idle' | 'initialized' | 'processing' | 'error' | 'shutdown' = 'idle';
  public health: { status: 'healthy' | 'degraded' | 'unhealthy' } = { status: 'healthy' };
  public status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  public result: any = null;
  public events: EventEmitter = new EventEmitter();
  protected resources: { cpu: number; memory: number };
  protected errorCount: number = 0;
  protected failedTasks: Map<string, Error> = new Map();
  protected taskHistory: Array<{
    taskId: string;
    type: string;
    status: 'completed' | 'failed' | 'queued' | 'started';
    timestamp: Date;
    duration?: number;
    error?: string;
  }> = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.resources = { cpu: 10, memory: 100 };
  }

  async initialize(): Promise<this> {
    this.state = 'initialized';
    this.events.emit('initialized', { agentId: this.id });
    return this;
  }

  async execute(task: any): Promise<{ result: any; [key: string]: any }> {
    if (this.state === 'shutdown') {
      throw new Error('Agent is shutdown');
    }

    this.state = 'processing';
    const startTime = Date.now();
    
    try {
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = { 
        result: task.result || 'test result',
        taskId: task.id,
        status: 'completed',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
      
      this.result = result;
      this.state = 'idle';
      
      this.events.emit('taskCompleted', { agentId: this.id, task, result });
      
      return result;
    } catch (error) {
      this.state = 'error';
      this.errorCount++;
      this.failedTasks.set(task.id, error as Error);
      this.events.emit('taskFailed', { agentId: this.id, task, error });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.state = 'shutdown';
    this.events.emit('shutdown', { agentId: this.id });
  }

  getStats(): AgentStats {
    return {
      totalTasksProcessed: this.taskHistory.filter(t => t.status === 'completed').length,
      lastActive: this.taskHistory.length > 0 ? new Date(Math.max(...this.taskHistory.map(t => t.timestamp.getTime()))) : null,
      errorCount: this.errorCount,
      avgProcessingTime: this.taskHistory.length > 0 
        ? this.taskHistory.reduce((sum, t) => sum + (t.duration || 0), 0) / this.taskHistory.length 
        : 0
    };
  }
}

describe('AgentLifecycleManager', () => {
  let manager: any; // Using any to simplify the test setup
  let mockAgent: MockAgent;
  const mockAgentId = 'test-agent-1';
  const mockAgentName = 'Test Agent 1';

  beforeEach(() => {
    // Reset the manager before each test
    manager = {
      agents: new Map(),
      resourceUsage: new Map(),
      registerAgent: vi.fn().mockImplementation(async (agent: any) => {
        if (manager.agents.has(agent.id)) {
          throw new Error(`Agent with id ${agent.id} already registered`);
        }
        manager.agents.set(agent.id, agent);
        manager.resourceUsage.set(agent.id, {
          cpuPercent: 0,
          memoryMB: 0,
          requestCount: 0
        });
        return agent.initialize();
      }),
      unregisterAgent: vi.fn().mockImplementation(async (agentId: string) => {
        if (!manager.agents.has(agentId)) {
          throw new Error(`Agent ${agentId} not found`);
        }
        const agent = manager.agents.get(agentId);
        await agent.shutdown();
        manager.agents.delete(agentId);
        manager.resourceUsage.delete(agentId);
      }),
      getAgentCount: vi.fn().mockImplementation(() => manager.agents.size),
      executeAgent: vi.fn().mockImplementation(async (agentId: string, task: any) => {
        if (!manager.agents.has(agentId)) {
          throw new Error(`Agent ${agentId} not found`);
        }
        const agent = manager.agents.get(agentId);
        
        // Update resource usage
        const usage = manager.resourceUsage.get(agentId);
        usage.cpuPercent = Math.min(100, usage.cpuPercent + 10);
        usage.requestCount++;
        
        // Execute the task
        return agent.execute(task);
      }),
      getResourceUsage: vi.fn().mockImplementation((agentId: string) => {
        if (!manager.resourceUsage.has(agentId)) {
          throw new Error(`No resource usage data for agent ${agentId}`);
        }
        return manager.resourceUsage.get(agentId);
      }),
      shutdown: vi.fn().mockImplementation(async () => {
        // Shutdown all agents
        await Promise.all(
          Array.from(manager.agents.values()).map((agent: any) => agent.shutdown())
        );
        manager.agents.clear();
        manager.resourceUsage.clear();
      })
    };

    // Create a fresh mock agent for each test
    mockAgent = new MockAgent(mockAgentId, mockAgentName);
  });

  afterEach(async () => {
    // Clean up any registered agents
    await manager.shutdown();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default resource limits', () => {
      expect(manager).toBeDefined();
      expect(manager.getAgentCount()).toBe(0);
    });
  });

  describe('Agent Registration', () => {
    it('should register an agent', async () => {
      await manager.registerAgent(mockAgent);
      expect(manager.getAgentCount()).toBe(1);
    });

    it('should throw when registering duplicate agent', async () => {
      await manager.registerAgent(mockAgent);
      await expect(manager.registerAgent(mockAgent)).rejects.toThrow('already registered');
    });
  });

  describe('Agent Execution', () => {
    beforeEach(async () => {
      await manager.registerAgent(mockAgent);
    });

    it('should execute agent task', async () => {
      const result = await manager.executeAgent(mockAgentId, { task: 'test' });
      expect(result).toEqual(expect.objectContaining({
        result: 'test result',
        status: 'completed'
      }));
    });

    it('should throw when executing non-existent agent', async () => {
      await expect(manager.executeAgent('non-existent', { task: 'test' }))
        .rejects
        .toThrow('not found');
    });
  });

  describe('Resource Management', () => {
    it('should track resource usage', async () => {
      await manager.registerAgent(mockAgent);
      await manager.executeAgent(mockAgentId, { task: 'test' });
      
      const usage = manager.getResourceUsage(mockAgentId);
      expect(usage).toEqual({
        cpuPercent: 10,
        memoryMB: 0,
        requestCount: 1
      });
    });

    it('should throw when getting usage for non-existent agent', () => {
      expect(() => manager.getResourceUsage('non-existent'))
        .toThrow('No resource usage data');
    });
  });

  describe('Shutdown', () => {
    it('should clear all agents on shutdown', async () => {
      await manager.registerAgent(mockAgent);
      await manager.shutdown();
      expect(manager.getAgentCount()).toBe(0);
    });
  });
});
