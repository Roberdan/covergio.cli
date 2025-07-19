import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentLifecycleManager } from '../../../src/universal/agents/AgentLifecycleManager';
import { 
  IAgent, 
  AgentState, 
  Capability, 
  PersonalityTrait, 
  ToolDefinition,
  ToolParameter 
} from '../../../src/universal/agents/types';
import { EventEmitter } from 'events';

// Simple mock agent for testing
class MockAgent extends EventEmitter implements IAgent {
  id: string;
  name: string;
  state: AgentState = 'initializing';
  isProcessing: boolean = false;
  processedTasks: Set<string> = new Set();
  executionTime: number = 10;
  config: any = {};
  definition: any = {};
  memory: any = {};
  private _health = {
    status: 'healthy' as const,
    uptime: 0,
    memoryUsage: 0,
    executionCount: 0,
    errorCount: 0,
    lastActivity: new Date()
  };
  
  // IAgent interface requirements
  tools: any[] = [];
  capabilities: string[] = [];
  dependencies: string[] = [];
  dependenciesMet: boolean = true;
  averageProcessingTime: number = 0;
  totalErrors: number = 0;
  
  constructor(id: string, name?: string) {
    super();
    this.id = id;
    this.name = name || `Mock Agent ${id}`;
  }
  
  async initialize(): Promise<void> {
    this.state = 'ready';
    this._health.lastActivity = new Date();
  }
  
  async execute(request: any, context?: any): Promise<any> {
    this.state = 'busy';
    this.isProcessing = true;
    const taskId = request.id || 'unknown';
    this.processedTasks.add(taskId);
    this._health.executionCount++;
    
    try {
      await new Promise(resolve => setTimeout(resolve, this.executionTime));
      const result = { 
        result: `Processed task: ${taskId}`,
        taskId,
        status: 'completed',
        timestamp: new Date().toISOString()
      };
      this.emit('task-completed', { taskId, result });
      return result;
    } catch (error) {
      this._health.errorCount++;
      this.totalErrors++;
      this.emit('task-failed', { 
        taskId, 
        error: error instanceof Error ? error : new Error(String(error))
      });
      throw error;
    } finally {
      this.state = 'ready';
      this.isProcessing = false;
      this._health.lastActivity = new Date();
      this.averageProcessingTime = (
        this.averageProcessingTime * (this._health.executionCount - 1) + this.executionTime
      ) / this._health.executionCount;
    }
  }
  
  async shutdown(): Promise<void> {
    try {
      this.state = 'terminated';
      this.emit('shutdown');
      return Promise.resolve();
    } catch (error) {
      this.state = 'error';
      this.emit('error', { 
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'shutdown'
      });
      return Promise.reject(error);
    }
  }
  
  // IAgent interface methods
  getCapabilities(): Capability[] {
    return [{
      id: 'test-capability',
      name: 'Test Capability',
      description: 'A test capability',
      category: 'domain-specific',
      level: 'intermediate',
      keywords: ['test']
    }];
  }
  
  getPersonality(): PersonalityTrait[] {
    return [{
      name: 'test-trait',
      value: 0.5,
      description: 'A test personality trait',
      category: 'communication'
    }];
  }
  
  getTools(): ToolDefinition[] {
    return [{
      id: 'test-tool',
      name: 'Test Tool',
      description: 'A test tool',
      category: 'test',
      accessLevel: 'public',
      parameters: [{
        name: 'param1',
        type: 'string',
        description: 'A test parameter',
        required: true
      }]
    }];
  }
  
  async pause(): Promise<void> {
    this.state = 'paused';
  }
  
  async resume(): Promise<void> {
    this.state = 'ready';
  }
  
  async terminate(): Promise<void> {
    await this.shutdown();
  }
  
  getLifecycleState(): string {
    return this.state;
  }
  
  getHealth() {
    return { ...this._health, executionCount: this.processedTasks.size };
  }
  
  getProcessedCount(): number {
    return this.processedTasks.size;
  }
  
  async updateConfig(config: any): Promise<void> {
    this.config = { ...this.config, ...config };
  }
  
  async serialize(): Promise<any> {
    return {
      id: this.id,
      name: this.name,
      state: this.state,
      config: this.config
    };
  }
  
  async deserialize(data: any): Promise<void> {
    this.id = data.id;
    this.name = data.name;
    this.state = data.state;
    this.config = data.config;
  }
  
  // For testing
  setExecutionTime(ms: number): void {
    this.executionTime = ms;
  }
}

describe('AgentLifecycleManager', () => {
  let manager: AgentLifecycleManager;
  let mockAgent: MockAgent;

  beforeEach(() => {
    manager = new AgentLifecycleManager();
    mockAgent = new MockAgent('test-agent');
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Agent Registration', () => {
    it('should register an agent', async () => {
      await manager.registerAgent(mockAgent);
      
      // Check if agent is registered
      const agents = Array.from((manager as any).agents.values());
      expect(agents).toHaveLength(1);
      expect(agents[0]).toBe(mockAgent);
      expect(mockAgent.state).toBe('ready');
    });
    
    it('should not register the same agent twice', async () => {
      await manager.registerAgent(mockAgent);
      
      // Try to register the same agent again
      await expect(manager.registerAgent(mockAgent)).rejects.toThrow(
        `Agent with ID ${mockAgent.id} is already registered`
      );
    });
  });
  
  describe('Agent Unregistration', () => {
    it('should unregister an agent', async () => {
      await manager.registerAgent(mockAgent);
      
      // Unregister the agent
      await manager.unregisterAgent(mockAgent.id);
      
      // Check if agent is unregistered
      const agents = Array.from((manager as any).agents.values());
      expect(agents).toHaveLength(0);
      expect(mockAgent.state).toBe('terminated');
    });
    
    it('should handle unregistering a non-existent agent gracefully', async () => {
      await expect(manager.unregisterAgent('non-existent-id')).resolves.not.toThrow();
    });
  });
  
  describe('Agent Execution', () => {
    it('should execute a task through an agent', async () => {
      await manager.registerAgent(mockAgent);
      const task = { id: 'test-task', data: 'test data' };
      
      // Execute the task
      const result = await manager['executeTask'](mockAgent.id, task);
      
      // Check the result
      expect(result).toBeDefined();
      expect(result.result).toContain(`Processed task: ${task.id}`);
      
      // Verify the agent processed the task
      expect(mockAgent.getProcessedCount()).toBe(1);
      expect(mockAgent.state).toBe('ready');
    });
    
    it('should handle task execution errors', async () => {
      await manager.registerAgent(mockAgent);
      const task = { id: 'failing-task' };
      
      // Mock the execute method to throw an error
      const originalExecute = mockAgent.execute;
      mockAgent.execute = vi.fn().mockRejectedValue(new Error('Task execution failed'));
      
      // Execute the task and expect it to reject
      await expect(manager['executeTask'](mockAgent.id, task)).rejects.toThrow('Task execution failed');
      
      // Restore the original method
      mockAgent.execute = originalExecute;
      expect(mockAgent.state).toBe('ready');
    });
  });
  
  describe('Agent Lifecycle', () => {
    it('should handle agent initialization', async () => {
      await manager.registerAgent(mockAgent);
      expect(mockAgent.state).toBe('ready');
    });
    
    it('should handle agent pause and resume', async () => {
      await manager.registerAgent(mockAgent);
      
      // Pause the agent
      await manager['pauseAgent'](mockAgent.id);
      expect(mockAgent.state).toBe('paused');
      
      // Resume the agent
      await manager['resumeAgent'](mockAgent.id);
      expect(mockAgent.state).toBe('ready');
    });
    
    it('should handle agent termination', async () => {
      await manager.registerAgent(mockAgent);
      await manager.unregisterAgent(mockAgent.id);
      expect(mockAgent.state).toBe('terminated');
    });
  });
});
