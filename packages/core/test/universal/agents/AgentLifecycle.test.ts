import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock agent implementation for lifecycle tests
class MockAgent {
  public id: string;
  public name: string;
  public state: 'idle' | 'initialized' | 'processing' | 'error' | 'shutdown' = 'idle';
  public health: { status: 'healthy' | 'degraded' | 'unhealthy' } = { status: 'healthy' };
  public status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  public result: unknown = null;
  public events: EventEmitter = new EventEmitter();
  public dependencies: string[] = [];
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

  constructor(id: string, name?: string) {
    this.id = id;
    this.name = name || `Mock Agent ${id}`;
    this.resources = { cpu: 10, memory: 100 };
  }

  async initialize(): Promise<this> {
    this.state = 'initialized';
    this.events.emit('initialized', { agentId: this.id });
    return this;
  }

  async execute(task: { id?: string; result?: string; [key: string]: unknown }): Promise<{
    result: string;
    taskId?: string;
    status: string;
    timestamp: string;
    duration: number;
  }> {
    if (this.state === 'shutdown') {
      throw new Error('Agent is shutdown');
    }

    this.state = 'processing';
    const startTime = Date.now();

    try {
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = {
        result: task.result || 'test result',
        taskId: task.id,
        status: 'completed',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      this.result = result;
      this.state = 'idle';

      this.events.emit('taskCompleted', { agentId: this.id, task, result });

      return result;
    } catch (error) {
      this.state = 'error';
      this.errorCount++;
      if (task.id) {
        this.failedTasks.set(task.id, error as Error);
      }
      this.events.emit('taskFailed', { agentId: this.id, task, error });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.state = 'shutdown';
    this.events.emit('shutdown', { agentId: this.id });
  }

  addDependency(agent: MockAgent): void {
    this.dependencies.push(agent.id);
  }

  getStats() {
    return {
      totalTasksProcessed: this.taskHistory.filter(t => t.status === 'completed').length,
      lastActive:
        this.taskHistory.length > 0
          ? new Date(Math.max(...this.taskHistory.map(t => t.timestamp.getTime())))
          : null,
      errorCount: this.errorCount,
      avgProcessingTime:
        this.taskHistory.length > 0
          ? this.taskHistory.reduce((sum, t) => sum + (t.duration || 0), 0) /
            this.taskHistory.length
          : 0,
    };
  }
}

// Mock lifecycle manager used across all lifecycle tests
function createMockManager() {
  const agents = new Map<string, MockAgent>();
  const resourceUsage = new Map<
    string,
    { cpuPercent: number; memoryMB: number; requestCount: number }
  >();

  return {
    agents,
    resourceUsage,

    registerAgent: vi.fn().mockImplementation(async (agent: MockAgent) => {
      if (agents.has(agent.id)) {
        throw new Error(`Agent with id ${agent.id} already registered`);
      }
      agents.set(agent.id, agent);
      resourceUsage.set(agent.id, {
        cpuPercent: 0,
        memoryMB: 0,
        requestCount: 0,
      });
      return agent.initialize();
    }),

    unregisterAgent: vi.fn().mockImplementation(async (agentId: string) => {
      if (!agents.has(agentId)) {
        throw new Error(`Agent ${agentId} not found`);
      }
      const agent = agents.get(agentId)!;
      await agent.shutdown();
      agents.delete(agentId);
      resourceUsage.delete(agentId);
    }),

    getAgentCount: vi.fn().mockImplementation(() => agents.size),

    executeAgent: vi
      .fn()
      .mockImplementation(async (agentId: string, task: Record<string, unknown>) => {
        if (!agents.has(agentId)) {
          throw new Error(`Agent ${agentId} not found`);
        }
        const agent = agents.get(agentId)!;

        // Check dependencies
        if (agent.dependencies.length > 0) {
          const missingDeps = agent.dependencies.filter(depId => !agents.has(depId));
          if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
          }
        }

        const usage = resourceUsage.get(agentId)!;
        usage.cpuPercent = Math.min(100, usage.cpuPercent + 10);
        usage.requestCount++;

        return agent.execute(task);
      }),

    getResourceUsage: vi.fn().mockImplementation((agentId: string) => {
      if (!resourceUsage.has(agentId)) {
        throw new Error(`No resource usage data for agent ${agentId}`);
      }
      return resourceUsage.get(agentId);
    }),

    shutdown: vi.fn().mockImplementation(async () => {
      await Promise.all(Array.from(agents.values()).map(agent => agent.shutdown()));
      agents.clear();
      resourceUsage.clear();
    }),
  };
}

describe('AgentLifecycle', () => {
  let manager: ReturnType<typeof createMockManager>;
  let mockAgent: MockAgent;

  beforeEach(() => {
    manager = createMockManager();
    mockAgent = new MockAgent('test-agent-1', 'Test Agent 1');
  });

  afterEach(async () => {
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
      const result = await manager.executeAgent('test-agent-1', { task: 'test' });
      expect(result).toEqual(
        expect.objectContaining({
          result: 'test result',
          status: 'completed',
        }),
      );
    });

    it('should execute a task and return processed result', async () => {
      const result = await manager.executeAgent('test-agent-1', { id: 'test-task' });
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should throw when executing non-existent agent', async () => {
      await expect(manager.executeAgent('non-existent', { task: 'test' })).rejects.toThrow(
        'not found',
      );
    });
  });

  describe('Resource Management', () => {
    it('should track resource usage', async () => {
      await manager.registerAgent(mockAgent);
      await manager.executeAgent('test-agent-1', { task: 'test' });

      const usage = manager.getResourceUsage('test-agent-1');
      expect(usage).toEqual({
        cpuPercent: 10,
        memoryMB: 0,
        requestCount: 1,
      });
    });

    it('should throw when getting usage for non-existent agent', () => {
      expect(() => manager.getResourceUsage('non-existent')).toThrow('No resource usage data');
    });
  });

  describe('Agent Dependencies', () => {
    it('should handle dependency checking', async () => {
      const agent1 = new MockAgent('agent-1', 'Agent 1');
      const agent2 = new MockAgent('agent-2', 'Agent 2');

      agent2.addDependency(agent1);

      await manager.registerAgent(agent2);

      // Should fail because agent1 is not registered
      await expect(manager.executeAgent('agent-2', { id: 'test' })).rejects.toThrow(
        'Missing dependencies: agent-1',
      );

      // Now register agent1 and execution should succeed
      await manager.registerAgent(agent1);
      const result = await manager.executeAgent('agent-2', { id: 'test' });
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  describe('Shutdown', () => {
    it('should clear all agents on shutdown', async () => {
      await manager.registerAgent(mockAgent);
      await manager.shutdown();
      expect(manager.getAgentCount()).toBe(0);
    });

    it('should shutdown all registered agents', async () => {
      const agent1 = new MockAgent('agent-a', 'Agent A');
      const agent2 = new MockAgent('agent-b', 'Agent B');

      await manager.registerAgent(agent1);
      await manager.registerAgent(agent2);
      expect(manager.getAgentCount()).toBe(2);

      await manager.shutdown();
      expect(manager.getAgentCount()).toBe(0);
      expect(agent1.state).toBe('shutdown');
      expect(agent2.state).toBe('shutdown');
    });
  });
});
