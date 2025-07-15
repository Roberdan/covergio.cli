/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToolRegistry, ToolDefinition, ToolExecutionContext } from '../../coordination/ToolRegistry';

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;
  let mockTool: ToolDefinition;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    
    mockTool = {
      id: 'test-tool',
      name: 'Test Tool',
      description: 'A test tool for unit testing',
      version: '1.0.0',
      category: 'testing',
      permissionLevel: 'public',
      rateLimits: {
        maxCallsPerMinute: 10,
        maxCallsPerHour: 100,
        maxCallsPerDay: 1000
      },
      schema: {
        parameters: {
          input: {
            type: 'string',
            description: 'Input text',
            required: true
          },
          options: {
            type: 'object',
            description: 'Optional parameters',
            required: false
          }
        },
        returns: {
          type: 'string',
          description: 'Processed output'
        }
      },
      execute: vi.fn().mockResolvedValue({
        success: true,
        result: 'processed output',
        executionTime: 100
      })
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Registration', () => {
    it('should register a valid tool successfully', async () => {
      await toolRegistry.registerTool(mockTool);
      
      const retrievedTool = toolRegistry.getTool('test-tool');
      expect(retrievedTool).toBeDefined();
      expect(retrievedTool?.name).toBe('Test Tool');
    });

    it('should emit tool-registered event', async () => {
      const eventListener = vi.fn();
      toolRegistry.on('tool-registered', eventListener);

      await toolRegistry.registerTool(mockTool);

      expect(eventListener).toHaveBeenCalledWith({
        toolId: 'test-tool',
        tool: mockTool,
        conflicts: []
      });
    });

    it('should reject tool with missing required fields', async () => {
      const invalidTool = { ...mockTool };
      delete (invalidTool as any).execute;

      await expect(toolRegistry.registerTool(invalidTool as any))
        .rejects.toThrow('Tool must have id, name, and execute function');
    });

    it('should reject duplicate tool IDs', async () => {
      await toolRegistry.registerTool(mockTool);

      await expect(toolRegistry.registerTool(mockTool))
        .rejects.toThrow('Tool with id test-tool already exists');
    });

    it('should reject tools with critical conflicts', async () => {
      const tool1 = { ...mockTool, id: 'tool1', dependencies: ['tool2'] };
      const tool2 = { ...mockTool, id: 'tool2', dependencies: ['tool1'] };

      await toolRegistry.registerTool(tool1);

      await expect(toolRegistry.registerTool(tool2))
        .rejects.toThrow('Critical conflicts detected');
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await toolRegistry.registerTool(mockTool);
    });

    it('should execute tool successfully', async () => {
      const context: ToolExecutionContext = {
        agentId: 'test-agent',
        timestamp: new Date(),
        parameters: { input: 'test input' },
        environment: {}
      };

      const result = await toolRegistry.executeTool('test-tool', context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('processed output');
      expect(mockTool.execute).toHaveBeenCalledWith(context);
    });

    it('should reject execution for non-existent tool', async () => {
      const context: ToolExecutionContext = {
        agentId: 'test-agent',
        timestamp: new Date(),
        parameters: {},
        environment: {}
      };

      await expect(toolRegistry.executeTool('non-existent', context))
        .rejects.toThrow('Tool non-existent not found');
    });

    it('should enforce permission levels', async () => {
      const restrictedTool = {
        ...mockTool,
        id: 'restricted-tool',
        permissionLevel: 'restricted' as const,
        allowedAgents: ['authorized-agent']
      };

      await toolRegistry.registerTool(restrictedTool);

      const context: ToolExecutionContext = {
        agentId: 'unauthorized-agent',
        timestamp: new Date(),
        parameters: {},
        environment: {}
      };

      await expect(toolRegistry.executeTool('restricted-tool', context))
        .rejects.toThrow('does not have permission');
    });

    it('should validate required parameters', async () => {
      const context: ToolExecutionContext = {
        agentId: 'test-agent',
        timestamp: new Date(),
        parameters: {}, // Missing required 'input' parameter
        environment: {}
      };

      await expect(toolRegistry.executeTool('test-tool', context))
        .rejects.toThrow("Required parameter 'input' is missing");
    });

    it('should enforce rate limits', async () => {
      const context: ToolExecutionContext = {
        agentId: 'test-agent',
        timestamp: new Date(),
        parameters: { input: 'test' },
        environment: {}
      };

      // Execute tool multiple times to exceed rate limit
      const promises = Array(11).fill(0).map(() => 
        toolRegistry.executeTool('test-tool', context)
      );

      await expect(Promise.all(promises))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Resource Locking', () => {
    it('should successfully lock and unlock resources', async () => {
      const lockResult = await toolRegistry.lockResource('resource-1', 'agent-1');
      expect(lockResult).toBe(true);

      await toolRegistry.unlockResource('resource-1', 'agent-1');
      
      // Should be able to lock again
      const secondLockResult = await toolRegistry.lockResource('resource-1', 'agent-2');
      expect(secondLockResult).toBe(true);
    });

    it('should prevent multiple agents from locking the same resource', async () => {
      await toolRegistry.lockResource('resource-1', 'agent-1');

      const secondLockResult = await toolRegistry.lockResource('resource-1', 'agent-2');
      expect(secondLockResult).toBe(false);
    });

    it('should auto-expire locks after timeout', async () => {
      vi.useFakeTimers();

      await toolRegistry.lockResource('resource-1', 'agent-1', 1000); // 1 second timeout

      vi.advanceTimersByTime(1500); // Advance past timeout

      const lockResult = await toolRegistry.lockResource('resource-1', 'agent-2');
      expect(lockResult).toBe(true);

      vi.useRealTimers();
    });

    it('should reject unlock by wrong agent', async () => {
      await toolRegistry.lockResource('resource-1', 'agent-1');

      await expect(toolRegistry.unlockResource('resource-1', 'agent-2'))
        .rejects.toThrow('is locked by agent-1, not agent-2');
    });

    it('should clear all locks', async () => {
      await toolRegistry.lockResource('resource-1', 'agent-1');
      await toolRegistry.lockResource('resource-2', 'agent-2');

      const clearListener = vi.fn();
      toolRegistry.on('all-locks-cleared', clearListener);

      toolRegistry.clearAllLocks();

      expect(clearListener).toHaveBeenCalledWith({
        clearedResources: ['resource-1', 'resource-2']
      });

      // Should be able to lock previously locked resources
      const lockResult1 = await toolRegistry.lockResource('resource-1', 'agent-3');
      const lockResult2 = await toolRegistry.lockResource('resource-2', 'agent-3');
      
      expect(lockResult1).toBe(true);
      expect(lockResult2).toBe(true);
    });
  });

  describe('Tool Statistics', () => {
    beforeEach(async () => {
      await toolRegistry.registerTool(mockTool);
    });

    it('should track tool usage statistics', async () => {
      const context: ToolExecutionContext = {
        agentId: 'test-agent',
        timestamp: new Date(),
        parameters: { input: 'test' },
        environment: {}
      };

      await toolRegistry.executeTool('test-tool', context);
      await toolRegistry.executeTool('test-tool', context);

      const stats = toolRegistry.getToolStats('test-tool');
      expect(stats.totalCalls).toBe(2);
      expect(stats.successfulCalls).toBe(2);
      expect(stats.failedCalls).toBe(0);
      expect(stats.usageByAgent['test-agent']).toBe(2);
    });

    it('should track failed executions', async () => {
      const failingTool = {
        ...mockTool,
        id: 'failing-tool',
        execute: vi.fn().mockRejectedValue(new Error('Tool execution failed'))
      };

      await toolRegistry.registerTool(failingTool);

      const context: ToolExecutionContext = {
        agentId: 'test-agent',
        timestamp: new Date(),
        parameters: { input: 'test' },
        environment: {}
      };

      try {
        await toolRegistry.executeTool('failing-tool', context, { maxRetries: 0 });
      } catch (error) {
        // Expected to fail
      }

      const stats = toolRegistry.getToolStats('failing-tool');
      expect(stats.totalCalls).toBeGreaterThanOrEqual(1); // May retry
      expect(stats.successfulCalls).toBe(0);
      expect(stats.failedCalls).toBeGreaterThanOrEqual(1);
    });

    it('should return all tool statistics', async () => {
      const tool2 = { ...mockTool, id: 'tool-2', name: 'Tool 2' };
      await toolRegistry.registerTool(tool2);

      const allStats = toolRegistry.getToolStats();
      expect(Array.isArray(allStats)).toBe(true);
      expect(allStats).toHaveLength(2);
      expect(allStats.map(s => s.toolId)).toContain('test-tool');
      expect(allStats.map(s => s.toolId)).toContain('tool-2');
    });
  });

  describe('Conflict Detection', () => {
    it('should detect name conflicts', async () => {
      const tool1 = { ...mockTool, id: 'tool1' };
      const tool2 = { ...mockTool, id: 'tool2', name: 'Test Tool' }; // Same name

      const conflicts = toolRegistry.detectToolConflicts(tool2);
      expect(conflicts).toHaveLength(0); // No conflict since tool1 not registered yet

      // Register first tool then check conflicts
      await toolRegistry.registerTool(tool1);
      const conflictsAfterRegistration = toolRegistry.detectToolConflicts(tool2);
      expect(conflictsAfterRegistration.some(c => c.type === 'resource')).toBe(true); // Now should detect conflict
    });

    it('should detect circular dependencies', () => {
      const tool1 = { ...mockTool, id: 'tool1', dependencies: ['tool2'] };
      const tool2 = { ...mockTool, id: 'tool2', dependencies: ['tool1'] };

      const conflicts = toolRegistry.detectToolConflicts(tool2);
      // Simulate tool1 being registered
      const mockTools = new Map([['tool1', tool1]]);
      (toolRegistry as any).tools = mockTools;

      const actualConflicts = toolRegistry.detectToolConflicts(tool2);
      expect(actualConflicts.some(c => c.type === 'dependency')).toBe(true);
    });

    it('should detect permission conflicts', async () => {
      const tool1 = { ...mockTool, id: 'tool1', category: 'analysis', permissionLevel: 'private' as const };
      const tool2 = { ...mockTool, id: 'tool2', category: 'analysis', permissionLevel: 'private' as const };

      await toolRegistry.registerTool(tool1);
      
      const conflicts = toolRegistry.detectToolConflicts(tool2);
      expect(conflicts.some(c => c.type === 'permission')).toBe(true);
    });
  });

  describe('Tool Unregistration', () => {
    beforeEach(async () => {
      await toolRegistry.registerTool(mockTool);
    });

    it('should unregister tool successfully', async () => {
      await toolRegistry.unregisterTool('test-tool');

      const tool = toolRegistry.getTool('test-tool');
      expect(tool).toBeUndefined();
    });

    it('should emit tool-unregistered event', async () => {
      const eventListener = vi.fn();
      toolRegistry.on('tool-unregistered', eventListener);

      await toolRegistry.unregisterTool('test-tool');

      expect(eventListener).toHaveBeenCalledWith({
        toolId: 'test-tool',
        tool: mockTool
      });
    });

    it('should reject unregistration of non-existent tool', async () => {
      await expect(toolRegistry.unregisterTool('non-existent'))
        .rejects.toThrow('Tool non-existent not found');
    });

    it('should reject unregistration of tool currently in use', async () => {
      // Start a tool execution but don't await it
      const context: ToolExecutionContext = {
        agentId: 'test-agent',
        timestamp: new Date(),
        parameters: { input: 'test' },
        environment: {}
      };

      // Mock a long-running execution
      mockTool.execute = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          result: 'result',
          executionTime: 1000
        }), 100))
      );

      const executionPromise = toolRegistry.executeTool('test-tool', context);

      // Try to unregister while execution is in progress
      await expect(toolRegistry.unregisterTool('test-tool'))
        .rejects.toThrow('currently being executed');

      // Wait for execution to complete
      await executionPromise;
    });
  });

  describe('Available Tools', () => {
    it('should return available tools for agent', async () => {
      await toolRegistry.registerTool(mockTool);

      const availableTools = toolRegistry.getAvailableTools('test-agent');
      expect(availableTools).toHaveLength(1);
      expect(availableTools[0].id).toBe('test-tool');
    });

    it('should filter tools based on permissions', async () => {
      const publicTool = { ...mockTool, id: 'public-tool', permissionLevel: 'public' as const };
      const privateTool = {
        ...mockTool,
        id: 'private-tool',
        permissionLevel: 'private' as const,
        allowedAgents: ['authorized-agent']
      };

      await toolRegistry.registerTool(publicTool);
      await toolRegistry.registerTool(privateTool);

      const unauthorizedTools = toolRegistry.getAvailableTools('unauthorized-agent');
      expect(unauthorizedTools).toHaveLength(1);
      expect(unauthorizedTools[0].id).toBe('public-tool');

      const authorizedTools = toolRegistry.getAvailableTools('authorized-agent');
      expect(authorizedTools).toHaveLength(2);
    });

    it('should return all tools for admin agents', async () => {
      const publicTool = { ...mockTool, id: 'public-tool' };
      const adminTool = { ...mockTool, id: 'admin-tool', permissionLevel: 'admin' as const };

      await toolRegistry.registerTool(publicTool);
      await toolRegistry.registerTool(adminTool);

      const adminTools = toolRegistry.getAvailableTools('admin-agent');
      expect(adminTools).toHaveLength(2);

      const regularTools = toolRegistry.getAvailableTools('regular-agent');
      expect(regularTools).toHaveLength(1);
      expect(regularTools[0].id).toBe('public-tool');
    });
  });
});