import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Minimal MockAgent implementation
class MinimalMockAgent {
  public id: string;
  public name: string;
  public state = 'idle';
  
  constructor(id: string, name?: string) {
    this.id = id;
    this.name = name || `Mock Agent ${id}`;
  }
  
  async execute(task: any) {
    return { result: `Processed ${task.id}` };
  }
  
  async shutdown() {
    this.state = 'shutdown';
  }
}

// Minimal AgentLifecycleManager
class MinimalAgentLifecycleManager {
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
    return agent.execute(task);
  }
  
  async shutdown() {
    for (const agent of this.agents.values()) {
      await agent.shutdown();
    }
    this.agents.clear();
  }
  
  getAgentCount() {
    return this.agents.size;
  }
}

describe('MinimalAgentLifecycleManager', () => {
  let manager: MinimalAgentLifecycleManager;
  let agent: MinimalMockAgent;
  
  beforeEach(() => {
    manager = new MinimalAgentLifecycleManager();
    agent = new MinimalMockAgent('test-agent', 'Test Agent');
  });
  
  afterEach(async () => {
    await manager.shutdown();
  });
  
  it('should register an agent', async () => {
    await manager.registerAgent(agent);
    expect(manager.getAgentCount()).toBe(1);
  });
  
  it('should execute a task', async () => {
    await manager.registerAgent(agent);
    const result = await manager.executeAgent('test-agent', { id: 'test-task' });
    expect(result).toEqual({ result: 'Processed test-task' });
  });
  
  it('should handle agent not found', async () => {
    await expect(manager.executeAgent('non-existent', { id: 'test' }))
      .rejects.toThrow('Agent non-existent not found');
  });
});
