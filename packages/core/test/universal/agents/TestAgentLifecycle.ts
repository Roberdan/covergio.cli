// Test file with a different name pattern
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

class TestAgent {
  public id: string;
  public name: string;
  
  constructor(id: string, name?: string) {
    this.id = id;
    this.name = name || `Test Agent ${id}`;
  }
  
  async execute(task: any) {
    return { result: `Processed ${task.id}` };
  }
}

class TestManager {
  private agents = new Map<string, TestAgent>();
  
  async registerAgent(agent: TestAgent) {
    this.agents.set(agent.id, agent);
  }
  
  async executeAgent(agentId: string, task: any) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    return agent.execute(task);
  }
}

describe('TestAgentLifecycle', () => {
  it('should work', async () => {
    const manager = new TestManager();
    const agent = new TestAgent('test-1');
    await manager.registerAgent(agent);
    const result = await manager.executeAgent('test-1', { id: 'task-1' });
    expect(result).toEqual({ result: 'Processed task-1' });
  });
});
