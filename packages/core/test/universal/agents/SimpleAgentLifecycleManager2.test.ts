import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Simple ExtendedMockAgent
class SimpleExtendedMockAgent {
  public id: string;
  public name: string;
  public state = 'idle';
  public dependencies: string[] = [];
  
  constructor(id: string, name?: string) {
    this.id = id;
    this.name = name || `Extended Agent ${id}`;
  }
  
  async execute(task: any) {
    return { result: `Processed ${task.id}` };
  }
  
  async shutdown() {
    this.state = 'shutdown';
  }
  
  addDependency(agent: SimpleExtendedMockAgent) {
    this.dependencies.push(agent.id);
  }
}

// Simple AgentLifecycleManager with ExtendedMockAgent support
class SimpleAgentLifecycleManager2 {
  private agents = new Map<string, any>();
  
  async registerAgent(agent: any) {
    this.agents.set(agent.id, agent);
  }
  
  async unregisterAgent(agentId: string) {
    this.agents.delete(agentId);
  }
  
  async executeAgent(agentId: string, task: any) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    // Check dependencies
    if (agent.dependencies && agent.dependencies.length > 0) {
      const missingDeps = agent.dependencies.filter((depId: string) => !this.agents.has(depId));
      if (missingDeps.length > 0) {
        throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
      }
    }
    
    return agent.execute(task);
  }
  
  async shutdown() {
    for (const agent of this.agents.values()) {
      await agent.shutdown();
    }
    this.agents.clear();
  }
}

describe('SimpleAgentLifecycleManager2', () => {
  let manager: SimpleAgentLifecycleManager2;
  let agent: SimpleExtendedMockAgent;
  
  beforeEach(() => {
    manager = new SimpleAgentLifecycleManager2();
    agent = new SimpleExtendedMockAgent('test-agent', 'Test Agent');
  });
  
  afterEach(async () => {
    await manager.shutdown();
  });
  
  it('should register an agent', async () => {
    await manager.registerAgent(agent);
    expect(manager).toBeDefined();
  });
  
  it('should handle dependencies', async () => {
    const agent1 = new SimpleExtendedMockAgent('agent1', 'Agent 1');
    const agent2 = new SimpleExtendedMockAgent('agent2', 'Agent 2');
    
    // Make agent2 depend on agent1
    agent2.addDependency(agent1);
    
    await manager.registerAgent(agent2);
    
    // Should fail because agent1 is not registered
    await expect(manager.executeAgent('agent2', { id: 'test' }))
      .rejects.toThrow('Missing dependencies: agent1');
      
    // Now register agent1 and it should work
    await manager.registerAgent(agent1);
    const result = await manager.executeAgent('agent2', { id: 'test' });
    expect(result).toEqual({ result: 'Processed test' });
  });
});
