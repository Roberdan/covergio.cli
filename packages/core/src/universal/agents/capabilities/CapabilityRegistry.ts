/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { Capability, ToolDefinition } from '../types.js';

/**
 * Extended capability interface
 */
export interface ExtendedCapability extends Capability {
  prerequisites?: string[];
  conflicts?: string[];
  tools: ToolDefinition[];
  examples: string[];
  documentation: string;
  metrics?: CapabilityMetrics;
  version: string;
  status: 'active' | 'deprecated' | 'experimental';
  author?: string;
  lastUpdated: Date;
}

/**
 * Capability metrics
 */
export interface CapabilityMetrics {
  usageCount: number;
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  lastUsed?: Date;
  performance: {
    fast: number;    // Operations under 1s
    medium: number;  // Operations 1-5s
    slow: number;    // Operations over 5s
  };
}

/**
 * Capability composition rule
 */
export interface CapabilityComposition {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  resultingCapability: ExtendedCapability;
  rules: CompositionRule[];
  examples: string[];
}

/**
 * Composition rule
 */
export interface CompositionRule {
  type: 'combine' | 'enhance' | 'specialize' | 'transform';
  sourceCapabilities: string[];
  targetCapability: string;
  conditions: Record<string, any>;
  parameters: Record<string, any>;
  weight: number;
}

/**
 * Capability dependency
 */
export interface CapabilityDependency {
  capabilityId: string;
  dependsOn: string[];
  type: 'hard' | 'soft' | 'optional';
  reason: string;
  alternatives?: string[];
}

/**
 * Capability conflict
 */
export interface CapabilityConflict {
  capability1: string;
  capability2: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  resolution?: string;
  canCoexist: boolean;
  conditions?: Record<string, any>;
}

/**
 * Capability validation result
 */
export interface CapabilityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  dependencies: CapabilityDependency[];
  conflicts: CapabilityConflict[];
}

/**
 * Capability search criteria
 */
export interface CapabilitySearchCriteria {
  keywords?: string[];
  category?: string;
  level?: string;
  domain?: string;
  tools?: string[];
  exclude?: string[];
  minSuccessRate?: number;
  maxExecutionTime?: number;
}

/**
 * Capability assignment result
 */
export interface CapabilityAssignmentResult {
  assigned: ExtendedCapability[];
  dependencies: ExtendedCapability[];
  conflicts: CapabilityConflict[];
  warnings: string[];
  suggestions: string[];
  totalComplexity: number;
  estimatedPerformance: {
    speed: 'fast' | 'medium' | 'slow';
    reliability: number;
    resourceUsage: 'low' | 'medium' | 'high';
  };
}

/**
 * Registry events
 */
export interface CapabilityRegistryEvents {
  'capability-registered': { capability: ExtendedCapability };
  'capability-updated': { capability: ExtendedCapability; previousVersion: string };
  'capability-deprecated': { capability: ExtendedCapability; reason: string };
  'composition-registered': { composition: CapabilityComposition };
  'dependency-added': { dependency: CapabilityDependency };
  'conflict-detected': { conflict: CapabilityConflict };
  'validation-completed': { capabilities: string[]; result: CapabilityValidationResult };
  'assignment-completed': { capabilities: string[]; result: CapabilityAssignmentResult };
}

/**
 * Capability registry implementation
 */
export class CapabilityRegistry extends EventEmitter {
  private capabilities = new Map<string, ExtendedCapability>();
  private compositions = new Map<string, CapabilityComposition>();
  private dependencies = new Map<string, CapabilityDependency[]>();
  private conflicts = new Map<string, CapabilityConflict[]>();
  private categories = new Map<string, string[]>();

  constructor() {
    super();
    this.initializeDefaultCapabilities();
  }

  /**
   * Register a new capability
   */
  registerCapability(capability: ExtendedCapability): void {
    // Validate capability
    this.validateCapabilityDefinition(capability);

    // Check for conflicts
    this.detectConflicts(capability);

    // Store capability
    this.capabilities.set(capability.id, capability);

    // Update category index
    this.updateCategoryIndex(capability);

    this.emit('capability-registered', { capability });
  }

  /**
   * Update existing capability
   */
  updateCapability(capabilityId: string, updates: Partial<ExtendedCapability>): boolean {
    const existing = this.capabilities.get(capabilityId);
    if (!existing) return false;

    const previousVersion = existing.version;
    const updated = {
      ...existing,
      ...updates,
      lastUpdated: new Date(),
      version: this.incrementVersion(existing.version)
    };

    this.capabilities.set(capabilityId, updated);
    this.updateCategoryIndex(updated);

    this.emit('capability-updated', { capability: updated, previousVersion });

    return true;
  }

  /**
   * Get capability by ID
   */
  getCapability(capabilityId: string): ExtendedCapability | null {
    return this.capabilities.get(capabilityId) || null;
  }

  /**
   * Get multiple capabilities
   */
  getCapabilities(capabilityIds: string[]): ExtendedCapability[] {
    return capabilityIds
      .map(id => this.capabilities.get(id))
      .filter((cap): cap is ExtendedCapability => cap !== undefined);
  }

  /**
   * Search capabilities
   */
  searchCapabilities(criteria: CapabilitySearchCriteria): ExtendedCapability[] {
    const allCapabilities = Array.from(this.capabilities.values());
    
    return allCapabilities.filter(capability => {
      // Filter by keywords
      if (criteria.keywords) {
        const hasKeywords = criteria.keywords.some(keyword =>
          capability.name.toLowerCase().includes(keyword.toLowerCase()) ||
          capability.description.toLowerCase().includes(keyword.toLowerCase()) ||
          capability.keywords?.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
        );
        if (!hasKeywords) return false;
      }

      // Filter by category
      if (criteria.category && capability.category !== criteria.category) {
        return false;
      }

      // Filter by level
      if (criteria.level && capability.level !== criteria.level) {
        return false;
      }

      // Filter by tools
      if (criteria.tools) {
        const hasTools = criteria.tools.some(tool =>
          capability.tools.some(t => t.id === tool)
        );
        if (!hasTools) return false;
      }

      // Filter by exclude list
      if (criteria.exclude && criteria.exclude.includes(capability.id)) {
        return false;
      }

      // Filter by success rate
      if (criteria.minSuccessRate && capability.metrics) {
        if (capability.metrics.successRate < criteria.minSuccessRate) {
          return false;
        }
      }

      // Filter by execution time
      if (criteria.maxExecutionTime && capability.metrics) {
        if (capability.metrics.averageExecutionTime > criteria.maxExecutionTime) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Assign capabilities to agent
   */
  assignCapabilities(capabilityIds: string[], domain?: string): CapabilityAssignmentResult {
    const assigned: ExtendedCapability[] = [];
    const dependencies: ExtendedCapability[] = [];
    const conflicts: CapabilityConflict[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Get requested capabilities
    for (const id of capabilityIds) {
      const capability = this.capabilities.get(id);
      if (!capability) {
        warnings.push(`Capability not found: ${id}`);
        continue;
      }

      if (capability.status === 'deprecated') {
        warnings.push(`Capability ${id} is deprecated`);
      }

      assigned.push(capability);
    }

    // Resolve dependencies
    const allDependencies = this.resolveDependencies(capabilityIds);
    for (const depId of allDependencies) {
      const dep = this.capabilities.get(depId);
      if (dep && !assigned.some(c => c.id === depId)) {
        dependencies.push(dep);
      }
    }

    // Check conflicts
    const allCapabilityIds = [...assigned.map(c => c.id), ...dependencies.map(c => c.id)];
    conflicts.push(...this.findConflicts(allCapabilityIds));

    // Generate suggestions
    if (domain) {
      const domainSuggestions = this.suggestCapabilitiesForDomain(domain, allCapabilityIds);
      suggestions.push(...domainSuggestions);
    }

    // Calculate metrics
    const totalComplexity = this.calculateComplexity(assigned);
    const estimatedPerformance = this.estimatePerformance(assigned);

    const result: CapabilityAssignmentResult = {
      assigned,
      dependencies,
      conflicts,
      warnings,
      suggestions,
      totalComplexity,
      estimatedPerformance
    };

    this.emit('assignment-completed', { capabilities: capabilityIds, result });

    return result;
  }

  /**
   * Validate capability set
   */
  validateCapabilities(capabilityIds: string[]): CapabilityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const dependencies: CapabilityDependency[] = [];
    const conflicts: CapabilityConflict[] = [];

    // Check if capabilities exist
    for (const id of capabilityIds) {
      if (!this.capabilities.has(id)) {
        errors.push(`Capability not found: ${id}`);
      }
    }

    // Get dependencies
    dependencies.push(...this.getDependencies(capabilityIds));

    // Find conflicts
    conflicts.push(...this.findConflicts(capabilityIds));

    // Check for circular dependencies
    const circular = this.findCircularDependencies(capabilityIds);
    if (circular.length > 0) {
      errors.push(`Circular dependencies detected: ${circular.join(', ')}`);
    }

    // Suggest missing capabilities
    const missing = this.findMissingCapabilities(capabilityIds);
    if (missing.length > 0) {
      suggestions.push(`Consider adding: ${missing.join(', ')}`);
    }

    const result: CapabilityValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      dependencies,
      conflicts
    };

    this.emit('validation-completed', { capabilities: capabilityIds, result });

    return result;
  }

  /**
   * Register capability composition
   */
  registerComposition(composition: CapabilityComposition): void {
    this.compositions.set(composition.id, composition);
    this.emit('composition-registered', { composition });
  }

  /**
   * Get compositions for capabilities
   */
  getCompositions(capabilityIds: string[]): CapabilityComposition[] {
    return Array.from(this.compositions.values()).filter(comp =>
      comp.requiredCapabilities.every(req => capabilityIds.includes(req))
    );
  }

  /**
   * Add dependency relationship
   */
  addDependency(dependency: CapabilityDependency): void {
    const existing = this.dependencies.get(dependency.capabilityId) || [];
    existing.push(dependency);
    this.dependencies.set(dependency.capabilityId, existing);

    this.emit('dependency-added', { dependency });
  }

  /**
   * Get all capabilities by category
   */
  getCapabilitiesByCategory(category: string): ExtendedCapability[] {
    return Array.from(this.capabilities.values()).filter(cap => cap.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get capability statistics
   */
  getStatistics(): {
    totalCapabilities: number;
    byCategory: Record<string, number>;
    byLevel: Record<string, number>;
    byStatus: Record<string, number>;
    averageSuccessRate: number;
    totalUsage: number;
  } {
    const capabilities = Array.from(this.capabilities.values());
    
    const byCategory: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalSuccessRate = 0;
    let totalUsage = 0;
    let capabilitiesWithMetrics = 0;

    for (const cap of capabilities) {
      byCategory[cap.category] = (byCategory[cap.category] || 0) + 1;
      byLevel[cap.level] = (byLevel[cap.level] || 0) + 1;
      byStatus[cap.status] = (byStatus[cap.status] || 0) + 1;

      if (cap.metrics) {
        totalSuccessRate += cap.metrics.successRate;
        totalUsage += cap.metrics.usageCount;
        capabilitiesWithMetrics++;
      }
    }

    return {
      totalCapabilities: capabilities.length,
      byCategory,
      byLevel,
      byStatus,
      averageSuccessRate: capabilitiesWithMetrics > 0 ? totalSuccessRate / capabilitiesWithMetrics : 0,
      totalUsage
    };
  }

  /**
   * Update capability metrics
   */
  updateMetrics(capabilityId: string, metrics: Partial<CapabilityMetrics>): boolean {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) return false;

    capability.metrics = {
      ...capability.metrics || {
        usageCount: 0,
        successRate: 0,
        averageExecutionTime: 0,
        errorRate: 0,
        performance: { fast: 0, medium: 0, slow: 0 }
      },
      ...metrics,
      lastUsed: new Date()
    };

    return true;
  }

  /**
   * Private helper methods
   */
  private validateCapabilityDefinition(capability: ExtendedCapability): void {
    if (!capability.id || !capability.name) {
      throw new Error('Capability must have id and name');
    }

    if (this.capabilities.has(capability.id)) {
      throw new Error(`Capability ${capability.id} already exists`);
    }
  }

  private detectConflicts(capability: ExtendedCapability): void {
    // Check against existing capabilities
    for (const existing of this.capabilities.values()) {
      if (capability.conflicts?.includes(existing.id) || 
          existing.conflicts?.includes(capability.id)) {
        
        const conflict: CapabilityConflict = {
          capability1: capability.id,
          capability2: existing.id,
          severity: 'medium',
          reason: 'Explicitly marked as conflicting',
          canCoexist: false
        };

        const conflicts = this.conflicts.get(capability.id) || [];
        conflicts.push(conflict);
        this.conflicts.set(capability.id, conflicts);

        this.emit('conflict-detected', { conflict });
      }
    }
  }

  private updateCategoryIndex(capability: ExtendedCapability): void {
    const categoryCapabilities = this.categories.get(capability.category) || [];
    if (!categoryCapabilities.includes(capability.id)) {
      categoryCapabilities.push(capability.id);
      this.categories.set(capability.category, categoryCapabilities);
    }
  }

  private resolveDependencies(capabilityIds: string[]): string[] {
    const resolved = new Set<string>();
    const toProcess = [...capabilityIds];

    while (toProcess.length > 0) {
      const currentId = toProcess.pop()!;
      if (resolved.has(currentId)) continue;

      resolved.add(currentId);

      const deps = this.dependencies.get(currentId) || [];
      for (const dep of deps) {
        for (const depId of dep.dependsOn) {
          if (!resolved.has(depId)) {
            toProcess.push(depId);
          }
        }
      }
    }

    return Array.from(resolved).filter(id => !capabilityIds.includes(id));
  }

  private findConflicts(capabilityIds: string[]): CapabilityConflict[] {
    const conflicts: CapabilityConflict[] = [];

    for (const id of capabilityIds) {
      const capabilityConflicts = this.conflicts.get(id) || [];
      for (const conflict of capabilityConflicts) {
        const otherCapability = conflict.capability1 === id ? conflict.capability2 : conflict.capability1;
        if (capabilityIds.includes(otherCapability)) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  private getDependencies(capabilityIds: string[]): CapabilityDependency[] {
    const dependencies: CapabilityDependency[] = [];

    for (const id of capabilityIds) {
      const capDeps = this.dependencies.get(id) || [];
      dependencies.push(...capDeps);
    }

    return dependencies;
  }

  private findCircularDependencies(capabilityIds: string[]): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circular: string[] = [];

    const dfs = (capabilityId: string): boolean => {
      if (recursionStack.has(capabilityId)) {
        circular.push(capabilityId);
        return true;
      }

      if (visited.has(capabilityId)) {
        return false;
      }

      visited.add(capabilityId);
      recursionStack.add(capabilityId);

      const deps = this.dependencies.get(capabilityId) || [];
      for (const dep of deps) {
        for (const depId of dep.dependsOn) {
          if (dfs(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(capabilityId);
      return false;
    };

    for (const id of capabilityIds) {
      if (!visited.has(id)) {
        dfs(id);
      }
    }

    return circular;
  }

  private findMissingCapabilities(capabilityIds: string[]): string[] {
    // This would implement logic to suggest related capabilities
    // For now, return empty array
    return [];
  }

  private suggestCapabilitiesForDomain(domain: string, excludeIds: string[]): string[] {
    return Array.from(this.capabilities.values())
      .filter(cap => 
        cap.keywords?.includes(domain) && 
        !excludeIds.includes(cap.id) &&
        cap.status === 'active'
      )
      .slice(0, 3)
      .map(cap => cap.name);
  }

  private calculateComplexity(capabilities: ExtendedCapability[]): number {
    return capabilities.reduce((total, cap) => {
      const levelComplexity = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[cap.level] || 2;
      return total + levelComplexity;
    }, 0);
  }

  private estimatePerformance(capabilities: ExtendedCapability[]): CapabilityAssignmentResult['estimatedPerformance'] {
    const avgExecutionTime = capabilities.reduce((sum, cap) => 
      sum + (cap.metrics?.averageExecutionTime || 1000), 0) / capabilities.length;
    
    const avgReliability = capabilities.reduce((sum, cap) => 
      sum + (cap.metrics?.successRate || 0.8), 0) / capabilities.length;

    const complexity = this.calculateComplexity(capabilities);

    return {
      speed: avgExecutionTime < 1000 ? 'fast' : avgExecutionTime < 5000 ? 'medium' : 'slow',
      reliability: avgReliability,
      resourceUsage: complexity < 5 ? 'low' : complexity < 10 ? 'medium' : 'high'
    };
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Initialize default capabilities
   */
  private initializeDefaultCapabilities(): void {
    // Technical capabilities
    this.registerCapability({
      id: 'programming',
      name: 'Programming',
      description: 'General programming and software development skills',
      category: 'technical',
      level: 'intermediate',
      dependencies: [],
      tools: [],
      keywords: ['programming', 'coding', 'development'],
      examples: ['Write functions', 'Debug code', 'Implement algorithms'],
      documentation: 'Basic programming capabilities including common languages and paradigms',
      version: '1.0.0',
      status: 'active',
      lastUpdated: new Date(),
      metrics: {
        usageCount: 0,
        successRate: 0.85,
        averageExecutionTime: 2000,
        errorRate: 0.15,
        performance: { fast: 60, medium: 30, slow: 10 }
      }
    });

    this.registerCapability({
      id: 'data-analysis',
      name: 'Data Analysis',
      description: 'Analyze and interpret data sets',
      category: 'analytical',
      level: 'advanced',
      dependencies: [],
      tools: [],
      keywords: ['data', 'analysis', 'statistics'],
      examples: ['Analyze trends', 'Generate reports', 'Statistical analysis'],
      documentation: 'Advanced data analysis and interpretation capabilities',
      version: '1.0.0',
      status: 'active',
      lastUpdated: new Date(),
      metrics: {
        usageCount: 0,
        successRate: 0.90,
        averageExecutionTime: 3000,
        errorRate: 0.10,
        performance: { fast: 40, medium: 50, slow: 10 }
      }
    });

    this.registerCapability({
      id: 'creative-writing',
      name: 'Creative Writing',
      description: 'Generate creative and engaging written content',
      category: 'creative',
      level: 'intermediate',
      dependencies: [],
      tools: [],
      keywords: ['writing', 'creative', 'content'],
      examples: ['Write stories', 'Create marketing copy', 'Draft articles'],
      documentation: 'Creative writing and content generation capabilities',
      version: '1.0.0',
      status: 'active',
      lastUpdated: new Date(),
      metrics: {
        usageCount: 0,
        successRate: 0.88,
        averageExecutionTime: 1500,
        errorRate: 0.12,
        performance: { fast: 70, medium: 25, slow: 5 }
      }
    });

    this.registerCapability({
      id: 'problem-solving',
      name: 'Problem Solving',
      description: 'Approach and solve complex problems systematically',
      category: 'analytical',
      level: 'advanced',
      dependencies: [],
      tools: [],
      keywords: ['problem', 'solving', 'analysis'],
      examples: ['Identify issues', 'Develop solutions', 'Optimize processes'],
      documentation: 'Systematic problem-solving and optimization capabilities',
      version: '1.0.0',
      status: 'active',
      lastUpdated: new Date(),
      metrics: {
        usageCount: 0,
        successRate: 0.82,
        averageExecutionTime: 4000,
        errorRate: 0.18,
        performance: { fast: 30, medium: 60, slow: 10 }
      }
    });

    this.registerCapability({
      id: 'communication',
      name: 'Communication',
      description: 'Effective communication and interpersonal skills',
      category: 'communication',
      level: 'intermediate',
      dependencies: [],
      tools: [],
      keywords: ['communication', 'interpersonal', 'collaboration'],
      examples: ['Explain concepts', 'Facilitate discussions', 'Write documentation'],
      documentation: 'Communication and interpersonal interaction capabilities',
      version: '1.0.0',
      status: 'active',
      lastUpdated: new Date(),
      metrics: {
        usageCount: 0,
        successRate: 0.92,
        averageExecutionTime: 1000,
        errorRate: 0.08,
        performance: { fast: 80, medium: 18, slow: 2 }
      }
    });

    // Add some dependencies
    this.addDependency({
      capabilityId: 'data-analysis',
      dependsOn: ['problem-solving'],
      type: 'soft',
      reason: 'Data analysis benefits from problem-solving skills'
    });

    this.addDependency({
      capabilityId: 'programming',
      dependsOn: ['problem-solving'],
      type: 'soft',
      reason: 'Programming requires systematic problem-solving approach'
    });
  }
}

/**
 * Type the EventEmitter properly
 */
export interface CapabilityRegistry {
  on<K extends keyof CapabilityRegistryEvents>(event: K, listener: (data: CapabilityRegistryEvents[K]) => void): this;
  emit<K extends keyof CapabilityRegistryEvents>(event: K, data: CapabilityRegistryEvents[K]): boolean;
}