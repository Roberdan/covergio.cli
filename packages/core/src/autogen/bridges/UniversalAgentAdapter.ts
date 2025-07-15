/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import {
  IAgent,
  AgentConfig,
  AgentDefinition,
  AgentRequest,
  AgentResponse,
  AgentState,
  Capability,
  PersonalityTrait,
  ToolDefinition,
  AgentContext
} from '../../universal/agents/types';
import {
  AutoGenAgentConfig,
  ConversationMessage,
  AutoGenTool,
  LLMConfig,
  AgentBridge,
  BridgeError
} from '../types';
import { PythonAutoGenBridge } from './PythonAutoGenBridge';

/**
 * State synchronization interface
 */
interface StateSyncData {
  lastSync: Date;
  pendingUpdates: string[];
  conversationHistory: ConversationMessage[];
  context: Record<string, any>;
}

/**
 * Agent mapping configuration
 */
interface AgentMapping {
  universalAgentId: string;
  autoGenAgentName: string;
  lastSync: Date;
  syncStatus: 'synchronized' | 'pending' | 'error';
  configuration: {
    universal: AgentConfig;
    autoGen: AutoGenAgentConfig;
  };
  state: StateSyncData;
}

/**
 * Advanced Universal Agent to AutoGen adapter with state synchronization
 */
export class UniversalAgentAdapter extends EventEmitter implements AgentBridge {
  private bridge: PythonAutoGenBridge;
  private agentMappings: Map<string, AgentMapping> = new Map();
  private activeConversations: Map<string, {
    universalAgentId: string;
    autoGenName: string;
    messages: ConversationMessage[];
    context: AgentContext;
  }> = new Map();

  constructor(bridge: PythonAutoGenBridge) {
    super();
    this.bridge = bridge;
    this.setupBridgeEventHandlers();
  }

  /**
   * Convert Universal Agent to AutoGen configuration with enhanced mapping
   */
  convertToAutoGen(definition: AgentDefinition): AutoGenAgentConfig {
    try {
      const systemMessage = this.buildSystemMessage(definition);
      const tools = this.mapCapabilitiesToTools(definition.capabilities);
      
      const config: AutoGenAgentConfig = {
        name: this.sanitizeAgentName(definition.role),
        role: definition.role,
        system_message: systemMessage,
        llm_config: this.buildLLMConfig(definition),
        tools,
        description: definition.description,
        max_consecutive_auto_reply: 10,
        human_input_mode: 'NEVER'
      };

      // Add code execution config if domain supports it
      if (this.supportsCodeExecution(definition.domain)) {
        config.code_execution_config = {
          work_dir: `./autogen_workspace/${definition.id}`,
          use_docker: false,
          timeout: 60
        };
      }

      return config;
    } catch (error) {
      throw new BridgeError(
        `Failed to convert Universal Agent to AutoGen: ${error.message}`,
        { definition, error }
      );
    }
  }

  /**
   * Convert AutoGen config back to Universal Agent definition
   */
  convertFromAutoGen(config: AutoGenAgentConfig): AgentDefinition {
    try {
      const capabilities = this.extractCapabilitiesFromTools(config.tools || []);
      const personalityTraits = this.extractPersonalityFromSystemMessage(config.system_message);
      const tools = this.convertAutoGenToolsToUniversal(config.tools || []);

      const definition: AgentDefinition = {
        id: this.generateAgentId(config.name),
        domain: this.inferDomain(config),
        role: config.role,
        description: config.description || `AutoGen agent: ${config.name}`,
        capabilities,
        personalityTraits,
        tools,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          source: 'autogen',
          originalConfig: config
        }
      };

      return definition;
    } catch (error) {
      throw new BridgeError(
        `Failed to convert AutoGen config to Universal Agent: ${error.message}`,
        { config, error }
      );
    }
  }

  /**
   * Map Universal Agent capabilities to AutoGen tools
   */
  mapCapabilities(capabilities: Capability[]): AutoGenTool[] {
    return capabilities.map(capability => ({
      type: 'function',
      function: {
        name: this.sanitizeFunctionName(capability.name),
        description: capability.description,
        parameters: {
          type: 'object',
          properties: this.buildParametersFromCapability(capability),
          required: this.extractRequiredParameters(capability)
        }
      },
      implementation: this.createCapabilityImplementation(capability)
    }));
  }

  /**
   * Map Universal Agent personality to AutoGen system message
   */
  mapPersonality(personalityTraits: PersonalityTrait[]): string {
    const systemParts = ['You are an AI assistant with the following characteristics:'];
    
    if (personalityTraits.length === 0) {
      return 'You are a helpful AI assistant.';
    }

    // Group traits by category
    const traitsByCategory = this.groupTraitsByCategory(personalityTraits);
    
    for (const [category, traits] of Object.entries(traitsByCategory)) {
      const traitDescriptions = traits.map(trait => 
        `${trait.name} (${Math.round(trait.value * 100)}%): ${trait.description}`
      );
      
      systemParts.push(`\n${this.formatCategoryName(category)}:`);
      systemParts.push(...traitDescriptions.map(desc => `- ${desc}`));
    }

    systemParts.push('\nRespond in a manner consistent with these personality traits.');
    
    return systemParts.join('\n');
  }

  /**
   * Create and register Universal Agent with AutoGen bridge
   */
  async registerUniversalAgent(
    universalAgent: IAgent,
    options: {
      syncFrequency?: number;
      enableBidirectionalSync?: boolean;
      autoStartConversations?: boolean;
    } = {}
  ): Promise<string> {
    try {
      // Convert Universal Agent to AutoGen config
      const autoGenConfig = this.convertToAutoGen(universalAgent.definition);
      
      // Create agent in AutoGen
      await this.bridge.createAgent(autoGenConfig);
      
      // Create mapping
      const mapping: AgentMapping = {
        universalAgentId: universalAgent.id,
        autoGenAgentName: autoGenConfig.name,
        lastSync: new Date(),
        syncStatus: 'synchronized',
        configuration: {
          universal: {
            id: universalAgent.id,
            domain: universalAgent.definition.domain,
            role: universalAgent.definition.role,
            capabilities: universalAgent.definition.capabilities.map(c => c.id),
            personalityTraits: universalAgent.definition.personalityTraits,
            tools: universalAgent.definition.tools.map(t => t.id)
          },
          autoGen: autoGenConfig
        },
        state: {
          lastSync: new Date(),
          pendingUpdates: [],
          conversationHistory: [],
          context: {}
        }
      };

      this.agentMappings.set(universalAgent.id, mapping);

      // Setup event handlers for state synchronization
      this.setupUniversalAgentEventHandlers(universalAgent, mapping);

      // Start periodic sync if enabled
      if (options.syncFrequency) {
        this.startPeriodicSync(universalAgent.id, options.syncFrequency);
      }

      this.emit('universalAgentRegistered', {
        universalAgentId: universalAgent.id,
        autoGenName: autoGenConfig.name,
        mapping
      });

      return autoGenConfig.name;
    } catch (error) {
      throw new BridgeError(
        `Failed to register Universal Agent: ${error.message}`,
        { universalAgent: universalAgent.id, error }
      );
    }
  }

  /**
   * Synchronize state between Universal Agent and AutoGen
   */
  async synchronizeState(
    universalAgent: IAgent,
    autoGenAgent: any
  ): Promise<void> {
    const mapping = this.agentMappings.get(universalAgent.id);
    if (!mapping) {
      throw new BridgeError('Agent mapping not found for synchronization');
    }

    try {
      mapping.syncStatus = 'pending';

      // Sync conversation history
      await this.syncConversationHistory(universalAgent, mapping);

      // Sync agent state
      await this.syncAgentState(universalAgent, mapping);

      // Sync context and memory
      await this.syncContext(universalAgent, mapping);

      mapping.lastSync = new Date();
      mapping.syncStatus = 'synchronized';
      mapping.state.pendingUpdates = [];

      this.emit('stateSynchronized', {
        universalAgentId: universalAgent.id,
        autoGenName: mapping.autoGenAgentName,
        syncTime: mapping.lastSync
      });

    } catch (error) {
      mapping.syncStatus = 'error';
      throw new BridgeError(
        `State synchronization failed: ${error.message}`,
        { universalAgent: universalAgent.id, error }
      );
    }
  }

  /**
   * Execute Universal Agent request through AutoGen
   */
  async executeUniversalRequest(
    universalAgentId: string,
    request: AgentRequest
  ): Promise<AgentResponse> {
    const mapping = this.agentMappings.get(universalAgentId);
    if (!mapping) {
      throw new BridgeError('Universal Agent not registered with AutoGen bridge');
    }

    try {
      // Convert request to AutoGen format
      const conversationMessage: ConversationMessage = {
        role: 'user',
        content: request.input,
        timestamp: new Date().toISOString(),
        agent_id: 'user'
      };

      // Store conversation context
      const conversationId = this.generateConversationId();
      this.activeConversations.set(conversationId, {
        universalAgentId,
        autoGenName: mapping.autoGenAgentName,
        messages: [conversationMessage],
        context: request.context
      });

      // Execute through AutoGen (mock for now - would use actual bridge)
      const autoGenResponse = await this.simulateAutoGenResponse(
        mapping.autoGenAgentName,
        conversationMessage
      );

      // Convert response back to Universal Agent format
      const response: AgentResponse = {
        type: 'text',
        content: autoGenResponse.content,
        context: request.context,
        executionTime: Date.now() - new Date(request.context.timestamp).getTime(),
        confidence: 0.9,
        metadata: {
          autoGenAgent: mapping.autoGenAgentName,
          conversationId,
          originalMessage: conversationMessage
        }
      };

      // Update conversation history
      const conversation = this.activeConversations.get(conversationId)!;
      conversation.messages.push(autoGenResponse);

      // Update mapping state
      mapping.state.conversationHistory.push(...conversation.messages);
      mapping.state.lastSync = new Date();

      return response;

    } catch (error) {
      throw new BridgeError(
        `Failed to execute Universal Agent request: ${error.message}`,
        { universalAgentId, request, error }
      );
    }
  }

  /**
   * Get all agent mappings
   */
  getAgentMappings(): AgentMapping[] {
    return Array.from(this.agentMappings.values());
  }

  /**
   * Get agent mapping by Universal Agent ID
   */
  getAgentMapping(universalAgentId: string): AgentMapping | undefined {
    return this.agentMappings.get(universalAgentId);
  }

  /**
   * Remove agent mapping
   */
  async unregisterUniversalAgent(universalAgentId: string): Promise<void> {
    const mapping = this.agentMappings.get(universalAgentId);
    if (!mapping) {
      return;
    }

    // Remove from active conversations
    for (const [convId, conv] of this.activeConversations) {
      if (conv.universalAgentId === universalAgentId) {
        this.activeConversations.delete(convId);
      }
    }

    // Remove mapping
    this.agentMappings.delete(universalAgentId);

    this.emit('universalAgentUnregistered', {
      universalAgentId,
      autoGenName: mapping.autoGenAgentName
    });
  }

  /**
   * Private helper methods
   */

  private setupBridgeEventHandlers(): void {
    this.bridge.on('agent.messageGenerated', (event) => {
      this.handleAutoGenMessage(event);
    });

    this.bridge.on('error.occurred', (event) => {
      this.emit('bridgeError', event);
    });
  }

  private setupUniversalAgentEventHandlers(
    universalAgent: IAgent,
    mapping: AgentMapping
  ): void {
    universalAgent.on('execution-completed', (event) => {
      mapping.state.pendingUpdates.push('execution-completed');
      this.emit('syncRequired', { universalAgentId: universalAgent.id });
    });

    universalAgent.on('state-changed', (event) => {
      mapping.state.pendingUpdates.push('state-changed');
      this.emit('syncRequired', { universalAgentId: universalAgent.id });
    });

    universalAgent.on('memory-updated', (event) => {
      mapping.state.pendingUpdates.push('memory-updated');
      this.emit('syncRequired', { universalAgentId: universalAgent.id });
    });
  }

  private buildSystemMessage(definition: AgentDefinition): string {
    const parts = [
      `You are ${definition.role} in the ${definition.domain} domain.`,
      definition.description
    ];

    if (definition.personalityTraits.length > 0) {
      parts.push('\nPersonality characteristics:');
      parts.push(this.mapPersonality(definition.personalityTraits));
    }

    if (definition.capabilities.length > 0) {
      parts.push('\nYour capabilities include:');
      definition.capabilities.forEach(cap => {
        parts.push(`- ${cap.name}: ${cap.description}`);
      });
    }

    return parts.join('\n');
  }

  private mapCapabilitiesToTools(capabilities: Capability[]): AutoGenTool[] {
    return capabilities.map(capability => ({
      type: 'function',
      function: {
        name: this.sanitizeFunctionName(capability.name),
        description: capability.description,
        parameters: {
          type: 'object',
          properties: this.buildParametersFromCapability(capability),
          required: this.extractRequiredParameters(capability)
        }
      },
      implementation: this.createCapabilityImplementation(capability)
    }));
  }

  private buildLLMConfig(definition: AgentDefinition): LLMConfig {
    // Extract LLM preferences from metadata or use defaults
    const defaultModel = 'gpt-4';
    const temperature = this.calculateTemperatureFromPersonality(definition.personalityTraits);
    
    return {
      model: definition.metadata?.preferredModel || defaultModel,
      temperature,
      max_tokens: 2000,
      top_p: 0.9
    };
  }

  private sanitizeAgentName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  }

  private sanitizeFunctionName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  private supportsCodeExecution(domain: string): boolean {
    const codeExecutionDomains = ['development', 'data-science', 'engineering', 'automation'];
    return codeExecutionDomains.includes(domain.toLowerCase());
  }

  private buildParametersFromCapability(capability: Capability): Record<string, any> {
    // This would map capability parameters to JSON schema format
    // For now, return a basic structure
    return {
      input: {
        type: 'string',
        description: `Input for ${capability.name}`
      }
    };
  }

  private extractRequiredParameters(capability: Capability): string[] {
    // For now, make input required for all capabilities
    return ['input'];
  }

  private createCapabilityImplementation(capability: Capability): (args: any) => Promise<any> {
    return async (args: any) => {
      // This would delegate to the actual capability implementation
      return `Executed capability: ${capability.name} with args: ${JSON.stringify(args)}`;
    };
  }

  private groupTraitsByCategory(traits: PersonalityTrait[]): Record<string, PersonalityTrait[]> {
    const grouped: Record<string, PersonalityTrait[]> = {};
    
    traits.forEach(trait => {
      if (!grouped[trait.category]) {
        grouped[trait.category] = [];
      }
      grouped[trait.category].push(trait);
    });
    
    return grouped;
  }

  private formatCategoryName(category: string): string {
    return category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private calculateTemperatureFromPersonality(traits: PersonalityTrait[]): number {
    // Calculate temperature based on creativity and variability traits
    const creativityTrait = traits.find(t => t.name.toLowerCase().includes('creativ'));
    const analyticalTrait = traits.find(t => t.name.toLowerCase().includes('analytical'));
    
    let temperature = 0.7; // Default
    
    if (creativityTrait) {
      temperature += creativityTrait.value * 0.3;
    }
    
    if (analyticalTrait) {
      temperature -= analyticalTrait.value * 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, temperature));
  }

  private generateAgentId(name: string): string {
    return `autogen-${name}-${Date.now()}`;
  }

  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private inferDomain(config: AutoGenAgentConfig): string {
    // Infer domain from agent configuration
    if (config.code_execution_config) {
      return 'development';
    }
    
    const role = config.role.toLowerCase();
    if (role.includes('analyst') || role.includes('research')) {
      return 'analysis';
    }
    if (role.includes('writer') || role.includes('content')) {
      return 'content';
    }
    
    return 'general';
  }

  private extractCapabilitiesFromTools(tools: AutoGenTool[]): Capability[] {
    return tools.map(tool => ({
      id: tool.function.name,
      name: tool.function.name,
      description: tool.function.description,
      category: 'technical' as const,
      level: 'intermediate' as const,
      keywords: [tool.function.name]
    }));
  }

  private extractPersonalityFromSystemMessage(systemMessage: string): PersonalityTrait[] {
    // Extract personality traits from system message
    // This is a simplified implementation
    const traits: PersonalityTrait[] = [];
    
    if (systemMessage.toLowerCase().includes('creative')) {
      traits.push({
        name: 'creative',
        value: 0.8,
        description: 'Tends to generate creative and innovative solutions',
        category: 'creativity'
      });
    }
    
    if (systemMessage.toLowerCase().includes('analytical')) {
      traits.push({
        name: 'analytical',
        value: 0.9,
        description: 'Approaches problems systematically and analytically',
        category: 'analytical'
      });
    }
    
    return traits;
  }

  private convertAutoGenToolsToUniversal(tools: AutoGenTool[]): ToolDefinition[] {
    return tools.map(tool => ({
      id: tool.function.name,
      name: tool.function.name,
      description: tool.function.description,
      parameters: this.convertParametersToUniversal(tool.function.parameters),
      category: 'general',
      accessLevel: 'public' as const,
      execute: tool.implementation
    }));
  }

  private convertParametersToUniversal(parameters: any): any[] {
    // Convert JSON schema parameters to Universal Tool parameters
    const result: any[] = [];
    
    if (parameters.properties) {
      for (const [name, prop] of Object.entries(parameters.properties as any)) {
        result.push({
          name,
          type: (prop as any).type || 'string',
          description: (prop as any).description || '',
          required: parameters.required?.includes(name) || false
        });
      }
    }
    
    return result;
  }

  private async syncConversationHistory(
    universalAgent: IAgent,
    mapping: AgentMapping
  ): Promise<void> {
    // Sync conversation history between systems
    // This would involve getting the latest conversations and updating both sides
  }

  private async syncAgentState(
    universalAgent: IAgent,
    mapping: AgentMapping
  ): Promise<void> {
    // Sync agent state (active, paused, etc.)
    const currentState = universalAgent.state;
    mapping.state.context.agentState = currentState;
  }

  private async syncContext(
    universalAgent: IAgent,
    mapping: AgentMapping
  ): Promise<void> {
    // Sync memory and context between systems
    const memory = universalAgent.memory;
    // This would involve synchronizing memory items
  }

  private startPeriodicSync(universalAgentId: string, frequency: number): void {
    setInterval(async () => {
      const mapping = this.agentMappings.get(universalAgentId);
      if (mapping && mapping.state.pendingUpdates.length > 0) {
        try {
          // Trigger sync for pending updates
          this.emit('syncRequired', { universalAgentId });
        } catch (error) {
          console.error(`Periodic sync failed for ${universalAgentId}:`, error);
        }
      }
    }, frequency);
  }

  private async simulateAutoGenResponse(
    agentName: string,
    message: ConversationMessage
  ): Promise<ConversationMessage> {
    // Simulate AutoGen response for testing
    return {
      role: 'assistant',
      content: `Response from ${agentName}: I understand your message "${message.content}". How can I help you further?`,
      name: agentName,
      timestamp: new Date().toISOString(),
      agent_id: agentName
    };
  }

  private handleAutoGenMessage(event: any): void {
    // Handle incoming messages from AutoGen
    this.emit('autoGenMessage', event);
  }
}