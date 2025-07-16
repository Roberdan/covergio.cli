/**
 * Tests for ServiceRegistry class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceRegistry, ServiceFactory } from './ServiceRegistry.js';

// Mock service for testing
class MockService {
  public initialized = false;
  
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  isReady(): boolean {
    return this.initialized;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  describe('registerInstance', () => {
    it('should register service instance', () => {
      const mockService = new MockService();
      registry.registerInstance('config', mockService as any);
      
      expect(registry.has('config')).toBe(true);
    });
  });

  describe('registerFactory', () => {
    it('should register service factory', () => {
      const factory: ServiceFactory<MockService> = {
        create: async () => new MockService()
      };
      
      registry.registerFactory('config', factory as any);
      expect(registry.has('config')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return existing instance', async () => {
      const mockService = new MockService();
      registry.registerInstance('config', mockService as any);
      
      const result = await registry.get('config');
      expect(result).toBe(mockService);
    });

    it('should create instance using factory', async () => {
      const factory: ServiceFactory<MockService> = {
        create: async () => new MockService()
      };
      
      registry.registerFactory('config', factory as any);
      const result = await registry.get('config');
      
      expect(result).toBeInstanceOf(MockService);
    });

    it('should throw error for unregistered service', async () => {
      await expect(registry.get('config')).rejects.toThrow(
        'No factory registered for service type: config'
      );
    });

    it('should cache singleton instances', async () => {
      const factory: ServiceFactory<MockService> = {
        create: vi.fn(async () => new MockService())
      };
      
      registry.registerFactory('config', factory as any, true);
      
      const result1 = await registry.get('config');
      const result2 = await registry.get('config');
      
      expect(result1).toBe(result2);
      expect(factory.create).toHaveBeenCalledTimes(1);
    });

    it('should not cache non-singleton instances', async () => {
      const factory: ServiceFactory<MockService> = {
        create: vi.fn(async () => new MockService())
      };
      
      registry.registerFactory('config', factory as any, false);
      
      const result1 = await registry.get('config');
      const result2 = await registry.get('config');
      
      expect(result1).not.toBe(result2);
      expect(factory.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('remove', () => {
    it('should remove service', () => {
      const mockService = new MockService();
      registry.registerInstance('config', mockService as any);
      
      expect(registry.has('config')).toBe(true);
      registry.remove('config');
      expect(registry.has('config')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all services', () => {
      const mockService = new MockService();
      registry.registerInstance('config', mockService as any);
      
      expect(registry.has('config')).toBe(true);
      registry.clear();
      expect(registry.has('config')).toBe(false);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return all registered types', () => {
      const mockService = new MockService();
      registry.registerInstance('config', mockService as any);
      
      const factory: ServiceFactory<MockService> = {
        create: async () => new MockService()
      };
      registry.registerFactory('embeddingService', factory as any);
      
      const types = registry.getRegisteredTypes();
      expect(types).toContain('config');
      expect(types).toContain('embeddingService');
    });
  });

  describe('initializeAll', () => {
    it('should initialize all singleton services', async () => {
      const factory: ServiceFactory<MockService> = {
        create: async () => new MockService()
      };
      
      registry.registerFactory('config', factory as any, true);
      await registry.initializeAll();
      
      const service = await registry.get('config');
      expect(service).toBeInstanceOf(MockService);
    });
  });

  describe('dispose', () => {
    it('should dispose all services with dispose method', async () => {
      const mockService = new MockService();
      const disposeSpy = vi.spyOn(mockService, 'dispose');
      
      registry.registerInstance('config', mockService as any);
      await registry.dispose();
      
      expect(disposeSpy).toHaveBeenCalled();
      expect(registry.has('config')).toBe(false);
    });
  });
});