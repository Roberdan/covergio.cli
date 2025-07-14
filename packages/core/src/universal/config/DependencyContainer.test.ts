/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyContainer, ServiceTokens } from './DependencyContainer.js';

class TestService {
  value: string;
  
  constructor(value = 'test') {
    this.value = value;
  }
}

class DependentService {
  constructor(public dependency: TestService) {}
}

describe('DependencyContainer', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = new DependencyContainer();
  });

  describe('registration', () => {
    it('should register a service factory', () => {
      container.register('test', () => new TestService());
      
      expect(container.has('test')).toBe(true);
    });

    it('should register a singleton instance', () => {
      const instance = new TestService('singleton');
      container.registerInstance('test', instance);
      
      expect(container.has('test')).toBe(true);
    });
  });

  describe('resolution', () => {
    it('should resolve a simple service', async () => {
      container.register('test', () => new TestService('resolved'));
      
      const service = await container.resolve<TestService>('test');
      
      expect(service).toBeInstanceOf(TestService);
      expect(service.value).toBe('resolved');
    });

    it('should resolve singleton instances', async () => {
      container.register('test', () => new TestService());
      
      const service1 = await container.resolve<TestService>('test');
      const service2 = await container.resolve<TestService>('test');
      
      expect(service1).toBe(service2); // same instance
    });

    it('should resolve non-singleton instances', async () => {
      container.register('test', () => new TestService(), false);
      
      const service1 = await container.resolve<TestService>('test');
      const service2 = await container.resolve<TestService>('test');
      
      expect(service1).not.toBe(service2); // different instances
      expect(service1.value).toBe(service2.value); // same values
    });

    it('should resolve async factory functions', async () => {
      container.register('test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return new TestService('async');
      });
      
      const service = await container.resolve<TestService>('test');
      
      expect(service.value).toBe('async');
    });

    it('should throw error for unregistered service', async () => {
      await expect(container.resolve('nonexistent')).rejects.toThrow(
        "Service 'nonexistent' not registered"
      );
    });
  });

  describe('dependencies', () => {
    it('should resolve services with dependencies', async () => {
      const depInstance = new TestService('dep');
      container.registerInstance('dependency', depInstance);
      container.register('dependent', () => new DependentService(depInstance));
      
      const service = await container.resolve<DependentService>('dependent');
      
      expect(service).toBeInstanceOf(DependentService);
      expect(service.dependency).toBeInstanceOf(TestService);
      expect(service.dependency.value).toBe('dep');
    });

    it('should detect circular dependencies', async () => {
      container.register('serviceA', () => ({}), true, ['serviceB']);
      container.register('serviceB', () => ({}), true, ['serviceA']);
      
      await expect(container.resolve('serviceA')).rejects.toThrow(
        "Circular dependency detected for service 'serviceA'"
      );
    });
  });

  describe('management', () => {
    it('should unregister services', () => {
      container.register('test', () => new TestService());
      
      expect(container.has('test')).toBe(true);
      
      container.unregister('test');
      
      expect(container.has('test')).toBe(false);
    });

    it('should clear all services', () => {
      container.register('test1', () => new TestService());
      container.register('test2', () => new TestService());
      
      expect(container.getRegisteredTokens()).toHaveLength(2);
      
      container.clear();
      
      expect(container.getRegisteredTokens()).toHaveLength(0);
    });

    it('should get registered tokens', () => {
      container.register('test1', () => new TestService());
      container.register('test2', () => new TestService());
      
      const tokens = container.getRegisteredTokens();
      
      expect(tokens).toContain('test1');
      expect(tokens).toContain('test2');
      expect(tokens).toHaveLength(2);
    });
  });

  describe('child containers', () => {
    it('should create child container with parent services', () => {
      container.register('parent-service', () => new TestService('parent'));
      
      const child = container.createChild();
      
      expect(child.has('parent-service')).toBe(true);
    });

    it('should allow child to override parent services', () => {
      container.register('service', () => new TestService('parent'));
      
      const child = container.createChild();
      child.register('service', () => new TestService('child'));
      
      expect(child.has('service')).toBe(true);
      // Child would have its own version when resolved
    });
  });

  describe('service tokens', () => {
    it('should have predefined service tokens', () => {
      expect(ServiceTokens.ORCHESTRATOR).toBe('IOrchestrator');
      expect(ServiceTokens.REQUEST_ANALYZER).toBe('IRequestAnalyzer');
      expect(ServiceTokens.REQUEST_ROUTER).toBe('IRequestRouter');
      expect(ServiceTokens.WORKFLOW_MANAGER).toBe('IWorkflowManager');
      expect(ServiceTokens.EVENT_SYSTEM).toBe('IEventSystem');
      expect(ServiceTokens.CONFIG_MANAGER).toBe('OrchestratorConfigManager');
      expect(ServiceTokens.LOGGER).toBe('Logger');
    });
  });
});