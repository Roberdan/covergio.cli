import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { BaseAgent, SimpleAgentMemory } from '../../../../src/universal/agents/BaseAgent.js';
import { 
  AgentState, 
  AgentDefinition, 
  AgentConfig, 
  Capability, 
  PersonalityTrait, 
  ToolDefinition,
  AgentRequest,
  AgentResponse,
  AgentContext
} from '../../../../src/universal/agents/types.js';
import { logger } from '../../../../src/utils/Logger.js';

// Mock logger to avoid console output during tests
vi.mock('../../../../src/utils/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

// Create a test agent class that extends BaseAgent
class TestAgent extends BaseAgent {
  public testState: string = 'test';
  
  constructor(definition: AgentDefinition, config: Partial<AgentConfig> = {}) {
    super(definition, config);
  }
  
  // Implement abstract methods
  async execute(request: AgentRequest): Promise<AgentResponse> {
    this._lastActivity = new Date();
    this._executionCount++;
    
    return {
      type: 'text',
      content: 'Test response',
      context: request.context,
      executionTime: 0,
      confidence: 1
    };
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let mockDefinition: AgentDefinition;
  let mockConfig: Partial<AgentConfig>;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create a mock agent definition
    mockDefinition = {
      id: 'test-agent',
      domain: 'testing',
      role: 'tester',
      description: 'Test agent',
      capabilities: [
        {
          id: 'test-capability',
          name: 'Test Capability',
          description: 'Test capability',
          category: 'domain-specific',
          level: 'intermediate'
        }
      ] as Capability[],
      personalityTraits: [
        {
          name: 'test-trait',
          value: 0.5,
          description: 'Test trait',
          category: 'communication'
        }
      ] as PersonalityTrait[],
      tools: [
        {
          id: 'test-tool',
          name: 'Test Tool',
          description: 'Test tool',
          parameters: [],
          category: 'test',
          accessLevel: 'public'
        }
      ] as ToolDefinition[],
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create a mock config
    mockConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000
    };
    
    // Create a new agent instance
    agent = new TestAgent(mockDefinition, mockConfig);
  });
  
  afterEach(async () => {
    // Clean up after each test
    await agent.terminate();
  });
  
  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.state).toBe('initializing');
      expect(agent.getHealth().status).toBe('healthy');
    });
    
    it('should initialize with provided definition and config', () => {
      expect(agent.definition).toEqual(mockDefinition);
      expect(agent.getCapabilities()).toEqual(mockDefinition.capabilities);
      expect(agent.getPersonality()).toEqual(mockDefinition.personalityTraits);
      expect(agent.getTools()).toEqual(mockDefinition.tools);
    });
    
    it('should initialize memory', () => {
      expect(agent.memory).toBeInstanceOf(SimpleAgentMemory);
    });
  });
  
  describe('State Management', () => {
    it('should transition states correctly', async () => {
      await agent.initialize();
      expect(agent.state).toBe('ready');
      
      await agent.pause();
      expect(agent.state).toBe('paused');
      
      await agent.resume();
      expect(agent.state).toBe('ready');
    });
    
    it('should not allow invalid state transitions', async () => {
      // Should not be able to go from initializing to paused
      await expect(agent.pause()).rejects.toThrow();
      
      // Initialize first
      await agent.initialize();
      
      // Should not be able to go from ready to initializing
      await expect(agent.forceTransition('initializing')).rejects.toThrow();
    });
    
    it('should emit state change events', async () => {
      const stateChangeListener = vi.fn();
      agent.on('state-changed', stateChangeListener);
      
      await agent.initialize();
      
      expect(stateChangeListener).toHaveBeenCalledWith({
        previousState: 'initializing',
        newState: 'ready',
        timestamp: expect.any(Date)
      });
    });
  });
  
  describe('Health Monitoring', () => {
    it('should report healthy status with no errors', () => {
      const health = agent.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.errorCount).toBe(0);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
    
    it('should report degraded status with errors', () => {
      // @ts-ignore - Accessing private member for testing
      agent._errorCount = 1;
      
      const health = agent.getHealth();
      expect(health.status).toBe('degraded');
    });
  });
  
  describe('Configuration', () => {
    it('should update configuration', async () => {
      const newConfig = { maxRetries: 5 };
      await agent.updateConfig(newConfig);
      
      // @ts-ignore - Accessing private member for testing
      expect(agent._config.maxRetries).toBe(5);
    });
    
    it('should validate configuration', async () => {
      await expect(agent.updateConfig({ maxRetries: -1 })).rejects.toThrow();
    });
  });
  
  describe('Serialization', () => {
    it('should serialize and deserialize correctly', async () => {
      // First initialize the agent
      await agent.initialize();
      
      // Serialize the agent state
      const serialized = await agent.serialize();
      expect(serialized).toBeDefined();
      
      // Create a new agent and deserialize the state
      const newAgent = new TestAgent(mockDefinition, mockConfig);
      await newAgent.deserialize(serialized);
      
      // Check that the state was restored correctly
      expect(newAgent.state).toBe('ready');
      expect(newAgent.getHealth().executionCount).toBe(agent.getHealth().executionCount);
    });
    
    it('should handle deserialization errors', async () => {
      await expect(agent.deserialize('invalid-json')).rejects.toThrow();
    });
  });
  
  describe('Execution', () => {
    it('should execute a request', async () => {
      await agent.initialize();
      
      const request: AgentRequest = {
        input: 'test input',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };
      
      const response = await agent.execute(request);
      expect(response).toBeDefined();
      expect(response.content).toBe('Test response');
      expect(agent.getHealth().executionCount).toBe(1);
    });
    
    it('should handle execution errors', async () => {
      // Create a test agent that always throws an error
      class ErrorAgent extends TestAgent {
        async execute(): Promise<AgentResponse> {
          throw new Error('Test error');
        }
      }
      
      const errorAgent = new ErrorAgent(mockDefinition, mockConfig);
      await errorAgent.initialize();
      
      const request: AgentRequest = {
        input: 'test input',
        context: {
          sessionId: 'test-session',
          executionId: 'test-execution',
          timestamp: new Date(),
          environment: {}
        }
      };
      
      await expect(errorAgent.execute(request)).rejects.toThrow('Test error');
      expect(errorAgent.getHealth().errorCount).toBe(1);
    });
  });
  
  describe('Lifecycle', () => {
    it('should complete full lifecycle', async () => {
      // Initial state
      expect(agent.state).toBe('initializing');
      
      // Initialize
      await agent.initialize();
      expect(agent.state).toBe('ready');
      
      // Pause
      await agent.pause();
      expect(agent.state).toBe('paused');
      
      // Resume
      await agent.resume();
      expect(agent.state).toBe('ready');
      
      // Terminate
      await agent.terminate();
      expect(agent.state).toBe('terminated');
    });
    
    it('should not allow operations after termination', async () => {
      await agent.initialize();
      await agent.terminate();
      
      await expect(agent.pause()).rejects.toThrow();
      await expect(agent.resume()).rejects.toThrow();
      
      const request: AgentRequest = {
        input: 'test',
        context: {
          sessionId: 'test',
          executionId: 'test',
          timestamp: new Date(),
          environment: {}
        }
      };
      
      await expect(agent.execute(request)).rejects.toThrow();
    });
  });
});
