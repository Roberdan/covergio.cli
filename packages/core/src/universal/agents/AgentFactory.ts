/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { 
  IAgent, 
  IAgentFactory, 
  AgentConfig, 
  AgentCreator, 
  AgentDefinition, 
  AgentTemplate, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  FactoryStatistics,
  ComponentRegistry,
  DIContainer,
  AgentFactoryConfig,
  AgentMemory,
  PersonalityTrait
} from './types.js';
import { PersonalityGenerator } from './personality/PersonalityGenerator.js';
import { CapabilityRegistry } from './capabilities/CapabilityRegistry.js';
import { PersonalityCapabilityManager } from './PersonalityCapabilityManager.js';
import { 
  IPersonalityCapabilityManager,
  IAgentFactoryIntegration,
  CompatibilityMatrix,
  CompositionStrategy
} from './interfaces.js';

/**
 * Simple component registry implementation
 */
class SimpleComponentRegistry implements ComponentRegistry {
  private components = new Map<string, any>();

  register(name: string, component: any): void {
    this.components.set(name, component);
  }

  unregister(name: string): void {
    this.components.delete(name);
  }

  get(name: string): any {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.components);
  }

  clear(): void {
    this.components.clear();
  }
}

/**
 * Simple dependency injection container
 */
class SimpleDIContainer implements DIContainer {
  private bindings = new Map<string, any>();
  private factories = new Map<string, () => any>();

  bind<T>(token: string, value: T): void {
    this.bindings.set(token, value);
  }

  bindFactory<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory);
  }

  get<T>(token: string): T {
    if (this.bindings.has(token)) {
      return this.bindings.get(token);
    }

    if (this.factories.has(token)) {
      const factory = this.factories.get(token)!;
      return factory();
    }

    throw new Error(`Token ${token} not found in DI container`);
  }

  has(token: string): boolean {
    return this.bindings.has(token) || this.factories.has(token);
  }

  resolve<T>(constructor: new (...args: any[]) => T): T {
    // Simple resolution - in a real implementation, this would analyze constructor parameters
    return new constructor();
  }
}

/**
 * Agent factory implementation with integrated personality and capability systems
 */
export class AgentFactory extends EventEmitter implements IAgentFactory, IAgentFactoryIntegration {
  private agentCreators = new Map<string, AgentCreator>();
  private templates = new Map<string, AgentTemplate>();
  private componentRegistry: ComponentRegistry;
  private diContainer: DIContainer;
  private config: AgentFactoryConfig;
  private statistics: FactoryStatistics;
  private activeAgents = new Set<string>();
  
  // Integrated personality and capability systems
  private personalityGenerator: PersonalityGenerator;
  private capabilityRegistry: CapabilityRegistry;
  private personalityCapabilityManager: PersonalityCapabilityManager;
  private compositionStrategies = new Map<string, CompositionStrategy>();

  constructor(config: AgentFactoryConfig = {}) {
    super();
    
    this.config = {
      defaultTimeout: 30000,
      defaultRetryAttempts: 3,
      maxConcurrentAgents: 100,
      enableMetrics: true,
      enableValidation: true,
      customValidators: {},
      ...config
    };

    this.componentRegistry = config.componentRegistry || new SimpleComponentRegistry();
    this.diContainer = config.diContainer || new SimpleDIContainer();
    
    this.statistics = {
      totalAgentsCreated: 0,
      activeAgents: 0,
      agentsByType: {},
      agentsByDomain: {},
      averageCreationTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      uptime: Date.now()
    };

    // Initialize integrated systems
    this.personalityGenerator = new PersonalityGenerator();
    this.capabilityRegistry = new CapabilityRegistry();
    this.personalityCapabilityManager = new PersonalityCapabilityManager(
      this.personalityGenerator, 
      this.capabilityRegistry
    );

    this.initializeDefaultComponents();
    this.initializeCompositionStrategies();
    this.setupIntegratedEventListeners();
  }

  /**
   * Create a new agent instance
   */
  async createAgent(config: AgentConfig): Promise<IAgent> {
    const startTime = Date.now();
    
    try {
      // Validate configuration
      if (this.config.enableValidation) {
        const validation = this.validateConfig(config);
        if (!validation.valid) {
          throw new Error(`Invalid agent configuration: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      // Check concurrent agent limit
      if (this.activeAgents.size >= this.config.maxConcurrentAgents!) {
        throw new Error(`Maximum concurrent agents limit reached: ${this.config.maxConcurrentAgents}`);
      }

      // Get agent type key
      const agentType = this.getAgentType(config.domain, config.role);
      
      // Get creator function
      const creator = this.agentCreators.get(agentType);
      if (!creator) {
        throw new Error(`No creator found for agent type: ${agentType}`);
      }

      // Prepare configuration with defaults
      const finalConfig = await this.prepareConfig(config);

      // Create agent instance
      const agent = await creator(finalConfig);

      // Register agent and update statistics
      this.activeAgents.add(agent.id);
      this.updateStatistics(agent, startTime);

      // Set up agent event listeners
      this.setupAgentEventListeners(agent);

      this.emit('agent-created', { agent, config: finalConfig });
      
      return agent;
    } catch (error) {
      this.statistics.errorRate = (this.statistics.errorRate * this.statistics.totalAgentsCreated + 1) / (this.statistics.totalAgentsCreated + 1);
      this.emit('agent-creation-failed', { config, error });
      throw error;
    }
  }

  /**
   * Register a new agent type
   */
  registerAgentType(type: string, creator: AgentCreator): void {
    this.agentCreators.set(type, creator);
    this.emit('agent-type-registered', { type });
  }

  /**
   * Unregister an agent type
   */
  unregisterAgentType(type: string): void {
    this.agentCreators.delete(type);
    this.emit('agent-type-unregistered', { type });
  }

  /**
   * Get available agent types
   */
  getAvailableTypes(): string[] {
    return Array.from(this.agentCreators.keys());
  }

  /**
   * Create agent from definition
   */
  async createFromDefinition(definition: AgentDefinition): Promise<IAgent> {
    const config: AgentConfig = {
      id: definition.id,
      domain: definition.domain,
      role: definition.role,
      capabilities: definition.capabilities.map(c => c.id),
      personalityTraits: definition.personalityTraits,
      tools: definition.tools.map(t => t.id)
    };

    return this.createAgent(config);
  }

  /**
   * Validate agent configuration
   */
  validateConfig(config: AgentConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    if (!config.domain) {
      errors.push({
        field: 'domain',
        message: 'Domain is required',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      });
    }

    if (!config.role) {
      errors.push({
        field: 'role',
        message: 'Role is required',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      });
    }

    // Domain validation
    if (config.domain && !this.isValidDomain(config.domain)) {
      errors.push({
        field: 'domain',
        message: 'Invalid domain format',
        code: 'INVALID_FORMAT',
        severity: 'error'
      });
    }

    // Role validation
    if (config.role && !this.isValidRole(config.role)) {
      errors.push({
        field: 'role',
        message: 'Invalid role format',
        code: 'INVALID_FORMAT',
        severity: 'error'
      });
    }

    // Capabilities validation
    if (config.capabilities) {
      const invalidCapabilities = config.capabilities.filter(cap => !this.isValidCapability(cap));
      if (invalidCapabilities.length > 0) {
        errors.push({
          field: 'capabilities',
          message: `Invalid capabilities: ${invalidCapabilities.join(', ')}`,
          code: 'INVALID_CAPABILITIES',
          severity: 'error'
        });
      }
    }

    // Personality traits validation
    if (config.personalityTraits) {
      for (const trait of config.personalityTraits) {
        if (trait.value < 0 || trait.value > 1) {
          errors.push({
            field: 'personalityTraits',
            message: `Personality trait ${trait.name} value must be between 0 and 1`,
            code: 'INVALID_RANGE',
            severity: 'error'
          });
        }
      }
    }

    // Tools validation
    if (config.tools) {
      const invalidTools = config.tools.filter(tool => !this.isValidTool(tool));
      if (invalidTools.length > 0) {
        warnings.push({
          field: 'tools',
          message: `Unknown tools: ${invalidTools.join(', ')}`,
          code: 'UNKNOWN_TOOLS',
          recommendation: 'Register tools before using them'
        });
      }
    }

    // Custom validators
    for (const [field, validator] of Object.entries(this.config.customValidators || {})) {
      if (field in config) {
        if (!validator((config as any)[field])) {
          errors.push({
            field,
            message: `Custom validation failed for ${field}`,
            code: 'CUSTOM_VALIDATION_FAILED',
            severity: 'error'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get agent template
   */
  getTemplate(domain: string, role: string): AgentTemplate | null {
    const key = `${domain}:${role}`;
    return this.templates.get(key) || null;
  }

  /**
   * Register component
   */
  registerComponent(name: string, component: any): void {
    this.componentRegistry.register(name, component);
  }

  /**
   * Get component
   */
  getComponent(name: string): any {
    return this.componentRegistry.get(name);
  }

  /**
   * Get factory statistics
   */
  getStatistics(): FactoryStatistics {
    return {
      ...this.statistics,
      activeAgents: this.activeAgents.size,
      uptime: Date.now() - this.statistics.uptime
    };
  }

  /**
   * Register agent template
   */
  registerTemplate(template: AgentTemplate): void {
    const key = `${template.domain}:${template.role}`;
    this.templates.set(key, template);
    this.emit('template-registered', { template });
  }

  /**
   * Get all templates
   */
  getTemplates(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.agentCreators.clear();
    this.templates.clear();
    this.activeAgents.clear();
    this.componentRegistry.clear();
    this.statistics = {
      totalAgentsCreated: 0,
      activeAgents: 0,
      agentsByType: {},
      agentsByDomain: {},
      averageCreationTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      uptime: Date.now()
    };
  }

  /**
   * Shutdown factory
   */
  async shutdown(): Promise<void> {
    this.emit('factory-shutting-down');
    
    // Clean up active agents
    this.activeAgents.clear();
    
    // Clear all data
    this.clear();
    
    this.emit('factory-shutdown');
    
    // Remove all event listeners after emitting final event
    this.removeAllListeners();
  }

  /**
   * Initialize default components
   */
  private initializeDefaultComponents(): void {
    // Register default memory provider if configured
    if (this.config.defaultMemoryProvider) {
      this.diContainer.bindFactory('memory', this.config.defaultMemoryProvider);
    }

    // Register default timeout
    this.diContainer.bind('timeout', this.config.defaultTimeout);

    // Register default retry attempts
    this.diContainer.bind('retryAttempts', this.config.defaultRetryAttempts);
  }

  /**
   * Get agent type key
   */
  private getAgentType(domain: string, role: string): string {
    return `${domain}:${role}`;
  }

  /**
   * Prepare configuration with defaults
   */
  private async prepareConfig(config: AgentConfig): Promise<AgentConfig> {
    const finalConfig: AgentConfig = {
      ...config,
      id: config.id || this.generateAgentId(),
      timeout: config.timeout || this.config.defaultTimeout,
      retryAttempts: config.retryAttempts || this.config.defaultRetryAttempts
    };

    // Inject memory if not provided
    if (!finalConfig.memory && this.diContainer.has('memory')) {
      finalConfig.memory = this.diContainer.get<AgentMemory>('memory');
    }

    return finalConfig;
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update statistics
   */
  private updateStatistics(agent: IAgent, startTime: number): void {
    this.statistics.totalAgentsCreated++;
    
    const creationTime = Date.now() - startTime;
    this.statistics.averageCreationTime = 
      (this.statistics.averageCreationTime * (this.statistics.totalAgentsCreated - 1) + creationTime) / 
      this.statistics.totalAgentsCreated;

    // Update type statistics
    const agentType = this.getAgentType(agent.definition.domain, agent.definition.role);
    this.statistics.agentsByType[agentType] = (this.statistics.agentsByType[agentType] || 0) + 1;

    // Update domain statistics
    this.statistics.agentsByDomain[agent.definition.domain] = 
      (this.statistics.agentsByDomain[agent.definition.domain] || 0) + 1;
  }

  /**
   * Set up agent event listeners
   */
  private setupAgentEventListeners(agent: IAgent): void {
    agent.on('state-changed', (data) => {
      if (data.newState === 'terminated') {
        this.activeAgents.delete(agent.id);
        this.emit('agent-terminated', { agent });
      }
    });

    agent.on('error', (data) => {
      this.emit('agent-error', { agent, error: data.error });
    });
  }

  /**
   * Validation helper methods
   */
  private isValidDomain(domain: string): boolean {
    return /^[a-z0-9-]+$/.test(domain);
  }

  private isValidRole(role: string): boolean {
    return /^[a-zA-Z0-9-\s]+$/.test(role);
  }

  private isValidCapability(capability: string): boolean {
    // In a real implementation, this would check against a capability registry
    return typeof capability === 'string' && capability.length > 0;
  }

  private isValidTool(tool: string): boolean {
    // In a real implementation, this would check against a tool registry
    return typeof tool === 'string' && tool.length > 0;
  }

  /**
   * Initialize composition strategies
   */
  private initializeCompositionStrategies(): void {
    // Default composition strategies will be implemented here
    this.registerCompositionStrategy({
      id: 'sequential',
      name: 'Sequential Composition',
      description: 'Combine capabilities in sequence',
      canHandle: (capabilities: string[]) => capabilities.length > 1,
      compose: async (capabilities) => {
        // Simple sequential composition
        return capabilities[0]; // Return first capability as base
      },
      getPriority: () => 1
    });
  }

  /**
   * Setup event listeners for integrated systems
   */
  private setupIntegratedEventListeners(): void {
    this.personalityCapabilityManager.on('personality-generated', (data) => {
      this.emit('personality-generated', data);
    });

    this.personalityCapabilityManager.on('capabilities-assigned', (data) => {
      this.emit('capabilities-assigned', data);
    });
  }

  // IAgentFactoryIntegration implementation methods

  /**
   * Create integrated personality
   */
  async createPersonality(profile: any, context: any): Promise<any> {
    return this.personalityCapabilityManager.generateOptimalPersonality(
      context.existingCapabilities || [],
      context
    );
  }

  /**
   * Create integrated capability
   */
  async createCapability(definition: any, context: any): Promise<any> {
    // This would create an IntegratedCapability from the definition
    // For now, return a placeholder
    throw new Error('Not implemented yet');
  }

  /**
   * Get compatibility matrix
   */
  async getCompatibilityMatrix(): Promise<CompatibilityMatrix> {
    return this.personalityCapabilityManager.getCompatibilityMatrix();
  }

  /**
   * Update compatibility matrix
   */
  async updateCompatibilityMatrix(matrix: Partial<CompatibilityMatrix>): Promise<void> {
    // Update the manager's compatibility matrix
    for (const [personalityId, capabilityData] of Object.entries(matrix)) {
      for (const [capabilityId, data] of Object.entries(capabilityData)) {
        await this.personalityCapabilityManager.updateCompatibilityMatrix(
          personalityId,
          capabilityId,
          data.compatibility
        );
      }
    }
  }

  /**
   * Get composition strategies
   */
  getCompositionStrategies(): CompositionStrategy[] {
    return Array.from(this.compositionStrategies.values());
  }

  /**
   * Register composition strategy
   */
  registerCompositionStrategy(strategy: CompositionStrategy): void {
    this.compositionStrategies.set(strategy.id, strategy);
  }

  /**
   * Get personality-capability manager
   */
  getPersonalityCapabilityManager(): IPersonalityCapabilityManager {
    return this.personalityCapabilityManager;
  }

  /**
   * Enhanced agent creation with personality and capability optimization
   */
  async createAgentWithOptimization(config: AgentConfig): Promise<IAgent> {
    // Generate optimal personality for required capabilities
    const personality = await this.personalityCapabilityManager.generateOptimalPersonality(
      config.capabilities || [],
      {
        domain: config.domain,
        role: config.role,
        requirements: [],
        constraints: [],
        existingCapabilities: config.capabilities || [],
        userPreferences: config.customSettings || {},
        collaborationNeeds: []
      }
    );

    // Assign optimal capabilities for the personality
    const capabilities = await this.personalityCapabilityManager.assignOptimalCapabilities(
      personality.id,
      {
        personalityId: personality.id,
        domain: config.domain,
        role: config.role,
        requiredCapabilities: config.capabilities || [],
        optionalCapabilities: [],
        constraints: [],
        performanceRequirements: {}
      }
    );

    // Update config with optimized personality and capabilities
    const optimizedConfig: AgentConfig = {
      ...config,
      personalityTraits: personality.traits,
      capabilities: capabilities.map(c => c.id)
    };

    // Create agent with optimized configuration
    return this.createAgent(optimizedConfig);
  }

  /**
   * Get personality generator
   */
  getPersonalityGenerator(): PersonalityGenerator {
    return this.personalityGenerator;
  }

  /**
   * Get capability registry
   */
  getCapabilityRegistry(): CapabilityRegistry {
    return this.capabilityRegistry;
  }
}

/**
 * Factory events interface
 */
export interface FactoryEvents {
  'agent-created': { agent: IAgent; config: AgentConfig };
  'agent-creation-failed': { config: AgentConfig; error: Error };
  'agent-terminated': { agent: IAgent };
  'agent-error': { agent: IAgent; error: Error };
  'agent-type-registered': { type: string };
  'agent-type-unregistered': { type: string };
  'template-registered': { template: AgentTemplate };
  'factory-shutting-down': void;
  'factory-shutdown': void;
}

/**
 * Type the EventEmitter properly
 */
export interface AgentFactory {
  on<K extends keyof FactoryEvents>(event: K, listener: (data: FactoryEvents[K]) => void): this;
  emit<K extends keyof FactoryEvents>(event: K, data: FactoryEvents[K]): boolean;
}