import { describe, it, expect } from 'vitest';
import { AgentLifecycleManager } from '../../../../src/universal/agents/AgentLifecycleManager';
import { MockAgent } from './AgentLifecycleManager.test';

describe('AgentLifecycleManager - Simplified', () => {
  it('should register an agent', async () => {
    const manager = new AgentLifecycleManager();
    const agent = new MockAgent('test-agent');
    
    await manager.registerAgent(agent);
    expect(manager.getAgentCount()).toBe(1);
  });

  it('should execute agent task', async () => {
    const manager = new AgentLifecycleManager();
    const agent = new MockAgent('test-agent');
    await manager.registerAgent(agent);
    
    const result = await manager.executeAgent('test-agent', { type: 'test' });
    expect(result).toBeDefined();
  });
});
