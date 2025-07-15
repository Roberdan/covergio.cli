/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentSpecificationRegistry } from './AgentSpecificationRegistry.js';
import { AgentSpecification } from './types.js';

describe('AgentSpecificationRegistry', () => {
  let registry: AgentSpecificationRegistry;

  const testSpecification: AgentSpecification = {
    id: 'test-agent',
    domain: 'testing',
    role: 'Test Agent',
    capabilities: [
      {
        id: 'test-capability',
        name: 'Testing Capability',
        category: 'technical',
        level: 'advanced',
        importance: 'high',
        keywords: ['test', 'testing'],
        description: 'Ability to perform testing tasks'
      }
    ],
    personalityTraits: [
      {
        name: 'methodical',
        strength: 0.8,
        description: 'Systematic approach to testing',
        category: 'methodical'
      }
    ],
    tools: [
      {
        id: 'test-tool',
        name: 'Test Tool',
        description: 'Tool for testing',
        category: 'testing',
        parameters: [],
        accessLevel: 'public'
      }
    ],
    confidence: 0.85,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      tags: ['test'],
      author: 'test'
    }
  };

  beforeEach(() => {
    registry = new AgentSpecificationRegistry();
  });

  describe('register', () => {
    it('should register a valid agent specification', () => {
      registry.register(testSpecification);
      
      const retrieved = registry.get('test-agent');
      expect(retrieved).toEqual(testSpecification);
    });

    it('should update existing specification when registering with same ID', () => {
      registry.register(testSpecification);
      
      const updatedSpec = { ...testSpecification, confidence: 0.95 };
      registry.register(updatedSpec);
      
      const retrieved = registry.get('test-agent');
      expect(retrieved?.confidence).toBe(0.95);
    });

    it('should emit registration event', () => {
      let emittedSpec: AgentSpecification | null = null;
      
      registry.on('specification-registered', (data: any) => {
        emittedSpec = data.specification;
      });
      
      registry.register(testSpecification);
      expect(emittedSpec).toEqual(testSpecification);
    });

    it('should throw error for invalid specification', () => {
      const invalidSpec = { ...testSpecification, id: '' };
      
      expect(() => registry.register(invalidSpec)).toThrow('Agent specification must have a valid ID');
    });

    it('should validate domain field', () => {
      const invalidSpec = { ...testSpecification, domain: '' };
      
      expect(() => registry.register(invalidSpec)).toThrow('Agent specification must have a valid domain');
    });

    it('should validate role field', () => {
      const invalidSpec = { ...testSpecification, role: '' };
      
      expect(() => registry.register(invalidSpec)).toThrow('Agent specification must have a valid role');
    });

    it('should validate capabilities array', () => {
      const invalidSpec = { ...testSpecification, capabilities: [] };
      
      expect(() => registry.register(invalidSpec)).toThrow('Agent specification must have at least one capability');
    });

    it('should validate confidence range', () => {
      const invalidSpec = { ...testSpecification, confidence: 1.5 };
      
      expect(() => registry.register(invalidSpec)).toThrow('Agent specification confidence must be between 0 and 1');
    });

    it('should validate capability IDs', () => {
      const invalidSpec = {
        ...testSpecification,
        capabilities: [{
          ...testSpecification.capabilities[0],
          id: ''
        }]
      };
      
      expect(() => registry.register(invalidSpec)).toThrow('Capability at index 0 must have a valid ID');
    });

    it('should validate tool IDs', () => {
      const invalidSpec = {
        ...testSpecification,
        tools: [{
          ...testSpecification.tools[0],
          id: ''
        }]
      };
      
      expect(() => registry.register(invalidSpec)).toThrow('Tool at index 0 must have a valid ID');
    });
  });

  describe('unregister', () => {
    it('should unregister existing specification', () => {
      registry.register(testSpecification);
      
      const result = registry.unregister('test-agent');
      expect(result).toBe(true);
      
      const retrieved = registry.get('test-agent');
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent specification', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should emit unregistration event', () => {
      let emittedId: string | null = null;
      
      registry.on('specification-unregistered', (data: any) => {
        emittedId = data.id;
      });
      
      registry.register(testSpecification);
      registry.unregister('test-agent');
      
      expect(emittedId).toBe('test-agent');
    });
  });

  describe('get and getAll', () => {
    it('should get specific specification by ID', () => {
      registry.register(testSpecification);
      
      const retrieved = registry.get('test-agent');
      expect(retrieved).toEqual(testSpecification);
    });

    it('should return undefined for non-existent specification', () => {
      const retrieved = registry.get('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get all specifications', () => {
      const specs = registry.getAll();
      expect(Array.isArray(specs)).toBe(true);
      expect(specs.length).toBeGreaterThan(0); // Should have default specs
    });
  });

  describe('findByCapability', () => {
    it('should find specifications by capability', () => {
      registry.register(testSpecification);
      
      const found = registry.findByCapability('test-capability');
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('test-agent');
    });

    it('should return empty array for non-existent capability', () => {
      const found = registry.findByCapability('non-existent-capability');
      expect(found).toHaveLength(0);
    });
  });

  describe('findByDomain', () => {
    it('should find specifications by domain', () => {
      registry.register(testSpecification);
      
      const found = registry.findByDomain('testing');
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('test-agent');
    });

    it('should return empty array for non-existent domain', () => {
      const found = registry.findByDomain('non-existent-domain');
      expect(found).toHaveLength(0);
    });
  });

  describe('findByRole', () => {
    it('should find specifications by role', () => {
      registry.register(testSpecification);
      
      const found = registry.findByRole('Test Agent');
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('test-agent');
    });

    it('should return empty array for non-existent role', () => {
      const found = registry.findByRole('Non-existent Role');
      expect(found).toHaveLength(0);
    });
  });

  describe('findByCriteria', () => {
    beforeEach(() => {
      registry.register(testSpecification);
    });

    it('should find by capabilities criteria', () => {
      const found = registry.findByCriteria({
        capabilities: ['test-capability']
      });
      
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('test-agent');
    });

    it('should find by domains criteria', () => {
      const found = registry.findByCriteria({
        domains: ['testing']
      });
      
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('test-agent');
    });

    it('should find by roles criteria', () => {
      const found = registry.findByCriteria({
        roles: ['Test Agent']
      });
      
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('test-agent');
    });

    it('should find by minimum confidence', () => {
      const found = registry.findByCriteria({
        minConfidence: 0.8
      });
      
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.every(spec => spec.confidence >= 0.8)).toBe(true);
    });

    it('should apply multiple criteria', () => {
      const found = registry.findByCriteria({
        domains: ['testing'],
        capabilities: ['test-capability'],
        minConfidence: 0.8
      });
      
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('test-agent');
    });

    it('should return empty array when no matches', () => {
      const found = registry.findByCriteria({
        domains: ['non-existent-domain']
      });
      
      expect(found).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register(testSpecification);
    });

    it('should search by domain', () => {
      const found = registry.search('testing');
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.some(spec => spec.id === 'test-agent')).toBe(true);
    });

    it('should search by role', () => {
      const found = registry.search('Test Agent');
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.some(spec => spec.id === 'test-agent')).toBe(true);
    });

    it('should search by capability name', () => {
      const found = registry.search('Testing Capability');
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.some(spec => spec.id === 'test-agent')).toBe(true);
    });

    it('should search by capability keywords', () => {
      const found = registry.search('test');
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.some(spec => spec.id === 'test-agent')).toBe(true);
    });

    it('should search by tool name', () => {
      const found = registry.search('Test Tool');
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.some(spec => spec.id === 'test-agent')).toBe(true);
    });

    it('should search by metadata tags', () => {
      const found = registry.search('test');
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.some(spec => spec.id === 'test-agent')).toBe(true);
    });

    it('should be case insensitive', () => {
      const found = registry.search('TESTING');
      expect(found.length).toBeGreaterThanOrEqual(1);
      expect(found.some(spec => spec.id === 'test-agent')).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const found = registry.search('zzznonexistent');
      expect(found).toHaveLength(0);
    });
  });

  describe('getAllCapabilities', () => {
    it('should return all unique capabilities', () => {
      const capabilities = registry.getAllCapabilities();
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);
      
      // Check uniqueness
      const ids = capabilities.map(cap => cap.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('getAllDomains', () => {
    it('should return all unique domains', () => {
      const domains = registry.getAllDomains();
      expect(Array.isArray(domains)).toBe(true);
      expect(domains.length).toBeGreaterThan(0);
      expect(domains).toContain('web-development');
      expect(domains).toContain('backend-development');
    });
  });

  describe('getAllRoles', () => {
    it('should return all unique roles', () => {
      const roles = registry.getAllRoles();
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
      expect(roles).toContain('Frontend Developer');
      expect(roles).toContain('Backend Developer');
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      const stats = registry.getStats();
      
      expect(stats).toHaveProperty('totalSpecifications');
      expect(stats).toHaveProperty('totalCapabilities');
      expect(stats).toHaveProperty('totalDomains');
      expect(stats).toHaveProperty('totalRoles');
      expect(stats).toHaveProperty('averageCapabilitiesPerSpec');
      expect(stats).toHaveProperty('averageConfidence');
      expect(stats).toHaveProperty('capabilityDistribution');
      expect(stats).toHaveProperty('domainDistribution');
      
      expect(typeof stats.totalSpecifications).toBe('number');
      expect(typeof stats.totalCapabilities).toBe('number');
      expect(typeof stats.averageConfidence).toBe('number');
      expect(stats.totalSpecifications).toBeGreaterThan(0);
    });
  });

  describe('default specifications', () => {
    it('should initialize with default specifications', () => {
      const specs = registry.getAll();
      expect(specs.length).toBeGreaterThan(0);
      
      // Check for some expected default agents
      const ids = specs.map(spec => spec.id);
      expect(ids).toContain('web-developer');
      expect(ids).toContain('backend-developer');
      expect(ids).toContain('data-analyst');
      expect(ids).toContain('devops-engineer');
    });

    it('should have valid default specifications', () => {
      const specs = registry.getAll();
      
      specs.forEach(spec => {
        expect(spec.id).toBeDefined();
        expect(spec.domain).toBeDefined();
        expect(spec.role).toBeDefined();
        expect(spec.capabilities.length).toBeGreaterThan(0);
        expect(spec.confidence).toBeGreaterThanOrEqual(0);
        expect(spec.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('indexing', () => {
    beforeEach(() => {
      registry.register(testSpecification);
    });

    it('should maintain capability index', () => {
      const found = registry.findByCapability('test-capability');
      expect(found).toHaveLength(1);
      
      // Unregister and check index is updated
      registry.unregister('test-agent');
      const foundAfter = registry.findByCapability('test-capability');
      expect(foundAfter).toHaveLength(0);
    });

    it('should maintain domain index', () => {
      const found = registry.findByDomain('testing');
      expect(found).toHaveLength(1);
      
      // Unregister and check index is updated
      registry.unregister('test-agent');
      const foundAfter = registry.findByDomain('testing');
      expect(foundAfter).toHaveLength(0);
    });

    it('should maintain role index', () => {
      const found = registry.findByRole('Test Agent');
      expect(found).toHaveLength(1);
      
      // Unregister and check index is updated
      registry.unregister('test-agent');
      const foundAfter = registry.findByRole('Test Agent');
      expect(foundAfter).toHaveLength(0);
    });
  });
});