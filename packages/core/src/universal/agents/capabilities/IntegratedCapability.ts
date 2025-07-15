/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { ExtendedCapability } from './CapabilityRegistry.js';
import { 
  ICapability, 
  CapabilityDependency, 
  CompatibilityRequirement, 
  ResourceRequirement,
  CombinationResult,
  CapabilityContext,
  CapabilityResult,
  PerformanceMetrics,
  ValidationResult
} from '../interfaces.js';

/**
 * Integrated capability implementation
 */
export class IntegratedCapability extends EventEmitter implements ICapability {
  // Inherit all properties from ExtendedCapability
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly category: 'technical' | 'creative' | 'analytical' | 'communication' | 'domain-specific';
  public readonly level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  public readonly dependencies?: string[];
  public readonly tools: any[];
  public readonly keywords?: string[];
  public readonly prerequisites?: string[];
  public readonly conflicts?: string[];
  public readonly examples: string[];
  public readonly documentation: string;
  public readonly metrics?: any;
  public readonly version: string;
  public readonly status: 'active' | 'deprecated' | 'experimental';
  public readonly author?: string;
  public readonly lastUpdated: Date;

  private readonly baseCapability: ExtendedCapability;
  private performanceMetrics: PerformanceMetrics;
  private executionHistory: Array<{
    timestamp: Date;
    executionTime: number;
    success: boolean;
    resourcesUsed: Record<string, number>;
  }> = [];

  constructor(baseCapability: ExtendedCapability) {
    super();
    
    this.baseCapability = baseCapability;
    
    // Copy all properties from base capability
    Object.assign(this, baseCapability);

    // Initialize performance metrics
    this.performanceMetrics = {
      successRate: baseCapability.metrics?.successRate || 0.8,
      averageExecutionTime: baseCapability.metrics?.averageExecutionTime || 1000,
      resourceEfficiency: 0.8,
      userSatisfactionScore: 0.8,
      errorRate: baseCapability.metrics?.errorRate || 0.2,
      lastUpdated: new Date()
    };
  }

  /**
   * Get capability dependencies
   */
  async getDependencies(): Promise<CapabilityDependency[]> {
    const dependencies: CapabilityDependency[] = [];

    // Process explicit dependencies
    if (this.dependencies) {
      for (const dep of this.dependencies) {
        dependencies.push({
          capabilityId: dep,
          dependencyType: 'required',
          reason: 'Explicit dependency defined in capability'
        });
      }
    }

    // Process prerequisites as optional dependencies
    if (this.prerequisites) {
      for (const prereq of this.prerequisites) {
        dependencies.push({
          capabilityId: prereq,
          dependencyType: 'optional',
          reason: 'Prerequisite for optimal performance'
        });
      }
    }

    // Add domain-specific dependencies based on category
    switch (this.category) {
      case 'technical':
        dependencies.push({
          capabilityId: 'problem-solving',
          dependencyType: 'conditional',
          reason: 'Technical capabilities benefit from problem-solving skills'
        });
        break;
      case 'creative':
        dependencies.push({
          capabilityId: 'open-thinking',
          dependencyType: 'conditional',
          reason: 'Creative capabilities benefit from open thinking'
        });
        break;
      case 'analytical':
        dependencies.push({
          capabilityId: 'data-processing',
          dependencyType: 'conditional',
          reason: 'Analytical capabilities require data processing'
        });
        break;
    }

    return dependencies;
  }

  /**
   * Get compatibility requirements for this capability
   */
  getCompatibilityRequirements(): CompatibilityRequirement[] {
    const requirements: CompatibilityRequirement[] = [];

    // Personality requirements based on capability category
    switch (this.category) {
      case 'technical':
        requirements.push({
          type: 'personality',
          requirement: 'analytical >= 0.6',
          level: 'should',
          description: 'Technical capabilities work better with analytical personalities'
        });
        requirements.push({
          type: 'personality',
          requirement: 'detail-oriented >= 0.5',
          level: 'should',
          description: 'Technical work requires attention to detail'
        });
        break;

      case 'creative':
        requirements.push({
          type: 'personality',
          requirement: 'creative >= 0.7',
          level: 'must',
          description: 'Creative capabilities require creative personality traits'
        });
        requirements.push({
          type: 'personality',
          requirement: 'open-minded >= 0.6',
          level: 'should',
          description: 'Creativity benefits from open-mindedness'
        });
        break;

      case 'analytical':
        requirements.push({
          type: 'personality',
          requirement: 'analytical >= 0.8',
          level: 'must',
          description: 'Analytical capabilities require strong analytical thinking'
        });
        requirements.push({
          type: 'personality',
          requirement: 'methodical >= 0.6',
          level: 'should',
          description: 'Analysis benefits from methodical approach'
        });
        break;

      case 'communication':
        requirements.push({
          type: 'personality',
          requirement: 'empathetic >= 0.6',
          level: 'should',
          description: 'Communication benefits from empathy'
        });
        requirements.push({
          type: 'personality',
          requirement: 'helpful >= 0.7',
          level: 'should',
          description: 'Communication requires helpfulness'
        });
        break;
    }

    // Tool requirements
    for (const tool of this.tools) {
      requirements.push({
        type: 'tool',
        requirement: tool.id,
        level: 'must',
        description: `Required tool: ${tool.name}`
      });
    }

    // Conflict requirements
    if (this.conflicts) {
      for (const conflict of this.conflicts) {
        requirements.push({
          type: 'capability',
          requirement: `NOT ${conflict}`,
          level: 'must',
          description: `Conflicts with capability: ${conflict}`
        });
      }
    }

    return requirements;
  }

  /**
   * Get resource requirements for this capability
   */
  getResourceRequirements(): ResourceRequirement[] {
    const requirements: ResourceRequirement[] = [];

    // Base requirements based on complexity level
    const complexityMultiplier = {
      'beginner': 1,
      'intermediate': 1.5,
      'advanced': 2,
      'expert': 3
    }[this.level];

    requirements.push({
      type: 'memory',
      amount: 256 * complexityMultiplier,
      unit: 'MB',
      description: 'Memory required for capability execution'
    });

    requirements.push({
      type: 'cpu',
      amount: 10 * complexityMultiplier,
      unit: 'percent',
      description: 'CPU usage for capability execution'
    });

    requirements.push({
      type: 'time',
      amount: this.performanceMetrics.averageExecutionTime * complexityMultiplier,
      unit: 'milliseconds',
      description: 'Expected execution time'
    });

    // Category-specific requirements
    switch (this.category) {
      case 'analytical':
        requirements.push({
          type: 'memory',
          amount: 512 * complexityMultiplier,
          unit: 'MB',
          description: 'Additional memory for data processing'
        });
        break;

      case 'creative':
        requirements.push({
          type: 'storage',
          amount: 100 * complexityMultiplier,
          unit: 'MB',
          description: 'Storage for creative assets and templates'
        });
        break;

      case 'technical':
        requirements.push({
          type: 'network',
          amount: 1024 * complexityMultiplier,
          unit: 'KB/s',
          description: 'Network bandwidth for technical operations'
        });
        break;
    }

    return requirements;
  }

  /**
   * Check if capability can be combined with others
   */
  async canCombineWith(capabilities: string[]): Promise<CombinationResult> {
    const conflicts: string[] = [];
    const synergies: string[] = [];
    const recommendations: string[] = [];
    let canCombine = true;

    // Check for explicit conflicts
    if (this.conflicts) {
      for (const conflict of this.conflicts) {
        if (capabilities.includes(conflict)) {
          conflicts.push(`Direct conflict with ${conflict}`);
          canCombine = false;
        }
      }
    }

    // Check for synergies based on category
    const synergyMap = {
      'technical': ['analytical', 'problem-solving'],
      'creative': ['communication', 'innovation'],
      'analytical': ['technical', 'research'],
      'communication': ['creative', 'interpersonal']
    };

    const potentialSynergies = synergyMap[this.category] || [];
    for (const cap of capabilities) {
      if (potentialSynergies.some(syn => cap.includes(syn))) {
        synergies.push(`Synergy with ${cap}`);
      }
    }

    // Check for level compatibility
    const advancedCapabilities = capabilities.filter(cap => cap.includes('advanced') || cap.includes('expert'));
    if (this.level === 'beginner' && advancedCapabilities.length > 0) {
      recommendations.push('Consider upgrading capability level for better integration');
    }

    // Generate recommendations
    if (synergies.length > 0) {
      recommendations.push('Strong synergies detected - optimal combination');
    }

    if (conflicts.length > 0) {
      recommendations.push('Resolve conflicts before combining capabilities');
    }

    if (capabilities.length > 5) {
      recommendations.push('Consider reducing capability count for better performance');
    }

    return {
      canCombine,
      conflicts,
      synergies,
      recommendations
    };
  }

  /**
   * Execute capability with given parameters
   */
  async execute(params: Record<string, any>, context: CapabilityContext): Promise<CapabilityResult> {
    const startTime = Date.now();
    let success = false;
    let result: any = null;
    let error: string | undefined;
    const resourcesUsed: Record<string, number> = {};

    try {
      // Validate parameters
      const validation = this.validateConfiguration(params);
      if (!validation.valid) {
        throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
      }

      // Simulate resource usage
      resourcesUsed.memory = this.getResourceRequirements().find(r => r.type === 'memory')?.amount || 256;
      resourcesUsed.cpu = Math.random() * 20;

      // Execute based on category
      result = await this.executeByCategory(params, context);
      success = true;

      this.emit('capability-executed', {
        capabilityId: this.id,
        success: true,
        executionTime: Date.now() - startTime,
        resourcesUsed
      });

    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      success = false;

      this.emit('capability-execution-failed', {
        capabilityId: this.id,
        error,
        executionTime: Date.now() - startTime
      });
    }

    const executionTime = Date.now() - startTime;
    
    // Update execution history
    this.executionHistory.push({
      timestamp: new Date(),
      executionTime,
      success,
      resourcesUsed
    });

    // Update performance metrics
    this.updatePerformanceMetrics(success, executionTime, resourcesUsed);

    return {
      success,
      result,
      error,
      executionTime,
      resourcesUsed,
      confidence: success ? 0.8 + Math.random() * 0.2 : 0.2
    };
  }

  /**
   * Get capability performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Validate capability configuration
   */
  validateConfiguration(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { valid: false, errors, warnings, suggestions };
    }

    // Tool-specific validation
    for (const tool of this.tools) {
      for (const param of tool.parameters) {
        if (param.required && !(param.name in config)) {
          errors.push(`Required parameter missing: ${param.name}`);
        }

        if (param.name in config) {
          const value = config[param.name];
          
          // Type validation
          if (param.type === 'number' && typeof value !== 'number') {
            errors.push(`Parameter ${param.name} must be a number`);
          }
          
          if (param.type === 'string' && typeof value !== 'string') {
            errors.push(`Parameter ${param.name} must be a string`);
          }

          // Range validation
          if (param.validation) {
            if (param.validation.min !== undefined && value < param.validation.min) {
              errors.push(`Parameter ${param.name} must be >= ${param.validation.min}`);
            }
            
            if (param.validation.max !== undefined && value > param.validation.max) {
              errors.push(`Parameter ${param.name} must be <= ${param.validation.max}`);
            }

            if (param.validation.enum && !param.validation.enum.includes(value)) {
              errors.push(`Parameter ${param.name} must be one of: ${param.validation.enum.join(', ')}`);
            }
          }
        }
      }
    }

    // Performance suggestions
    if (Object.keys(config).length > 10) {
      suggestions.push('Consider simplifying configuration for better performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Execute capability based on its category
   */
  private async executeByCategory(params: Record<string, any>, context: CapabilityContext): Promise<any> {
    switch (this.category) {
      case 'technical':
        return this.executeTechnicalCapability(params, context);
      
      case 'creative':
        return this.executeCreativeCapability(params, context);
      
      case 'analytical':
        return this.executeAnalyticalCapability(params, context);
      
      case 'communication':
        return this.executeCommunicationCapability(params, context);
      
      default:
        return this.executeGenericCapability(params, context);
    }
  }

  private async executeTechnicalCapability(params: Record<string, any>, context: CapabilityContext): Promise<any> {
    // Simulate technical execution
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    return {
      type: 'technical',
      result: `Technical operation completed with params: ${JSON.stringify(params)}`,
      metrics: {
        performance: 0.8 + Math.random() * 0.2,
        accuracy: 0.9 + Math.random() * 0.1
      }
    };
  }

  private async executeCreativeCapability(params: Record<string, any>, context: CapabilityContext): Promise<any> {
    // Simulate creative execution
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    
    return {
      type: 'creative',
      result: `Creative output generated with inspiration from: ${JSON.stringify(params)}`,
      metrics: {
        originality: 0.7 + Math.random() * 0.3,
        quality: 0.8 + Math.random() * 0.2
      }
    };
  }

  private async executeAnalyticalCapability(params: Record<string, any>, context: CapabilityContext): Promise<any> {
    // Simulate analytical execution
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
    
    return {
      type: 'analytical',
      result: `Analysis completed with findings based on: ${JSON.stringify(params)}`,
      metrics: {
        accuracy: 0.9 + Math.random() * 0.1,
        completeness: 0.85 + Math.random() * 0.15
      }
    };
  }

  private async executeCommunicationCapability(params: Record<string, any>, context: CapabilityContext): Promise<any> {
    // Simulate communication execution
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    return {
      type: 'communication',
      result: `Communication delivered with style: ${JSON.stringify(params)}`,
      metrics: {
        clarity: 0.8 + Math.random() * 0.2,
        engagement: 0.75 + Math.random() * 0.25
      }
    };
  }

  private async executeGenericCapability(params: Record<string, any>, context: CapabilityContext): Promise<any> {
    // Simulate generic execution
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 150));
    
    return {
      type: 'generic',
      result: `Operation completed with parameters: ${JSON.stringify(params)}`,
      metrics: {
        success: 0.8 + Math.random() * 0.2
      }
    };
  }

  /**
   * Update performance metrics based on execution results
   */
  private updatePerformanceMetrics(success: boolean, executionTime: number, resourcesUsed: Record<string, number>): void {
    const history = this.executionHistory;
    const recentHistory = history.slice(-10); // Last 10 executions
    
    // Update success rate
    const successCount = recentHistory.filter(h => h.success).length;
    this.performanceMetrics.successRate = successCount / recentHistory.length;
    
    // Update average execution time
    const avgTime = recentHistory.reduce((sum, h) => sum + h.executionTime, 0) / recentHistory.length;
    this.performanceMetrics.averageExecutionTime = avgTime;
    
    // Update error rate
    this.performanceMetrics.errorRate = 1 - this.performanceMetrics.successRate;
    
    // Update resource efficiency
    const avgMemoryUsed = recentHistory.reduce((sum, h) => sum + (h.resourcesUsed.memory || 0), 0) / recentHistory.length;
    const expectedMemory = this.getResourceRequirements().find(r => r.type === 'memory')?.amount || 256;
    this.performanceMetrics.resourceEfficiency = Math.max(0, 1 - (avgMemoryUsed / expectedMemory - 1));
    
    // Update user satisfaction (simulate based on success rate and performance)
    this.performanceMetrics.userSatisfactionScore = this.performanceMetrics.successRate * 0.7 + 
                                                   this.performanceMetrics.resourceEfficiency * 0.3;
    
    this.performanceMetrics.lastUpdated = new Date();
  }
}

/**
 * Capability execution events
 */
export interface CapabilityExecutionEvents {
  'capability-executed': {
    capabilityId: string;
    success: boolean;
    executionTime: number;
    resourcesUsed: Record<string, number>;
  };
  'capability-execution-failed': {
    capabilityId: string;
    error: string;
    executionTime: number;
  };
}

/**
 * Type the EventEmitter properly
 */
export interface IntegratedCapability {
  on<K extends keyof CapabilityExecutionEvents>(event: K, listener: (data: CapabilityExecutionEvents[K]) => void): this;
  emit<K extends keyof CapabilityExecutionEvents>(event: K, data: CapabilityExecutionEvents[K]): boolean;
}