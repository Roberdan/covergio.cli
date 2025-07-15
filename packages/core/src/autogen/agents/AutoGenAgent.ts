/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import {
  AutoGenAgent as IAutoGenAgent,
  AutoGenAgentConfig,
  ConversationMessage,
  AutoGenTool,
  LLMConfig,
  AgentCreationError,
  ConversationError,
  ToolExecutionError
} from '../types';

/**
 * AutoGen Agent Wrapper Implementation
 * 
 * This class wraps the Microsoft AutoGen agent functionality
 * and provides a consistent interface for our system
 */
export class AutoGenAgent extends EventEmitter implements IAutoGenAgent {
  public readonly name: string;
  public readonly role: string;
  public readonly config: AutoGenAgentConfig;
  
  private tools: Map<string, AutoGenTool> = new Map();
  private conversationHistory: ConversationMessage[] = [];
  private isInitialized: boolean = false;

  constructor(config: AutoGenAgentConfig) {
    super();
    
    this.validateConfig(config);
    
    this.name = config.name;
    this.role = config.role;
    this.config = { ...config };
    
    // Initialize tools if provided
    if (config.tools) {
      config.tools.forEach(tool => this.addTool(tool));
    }
    
    this.initialize();
  }

  /**
   * Initialize the AutoGen agent
   */
  private async initialize(): Promise<void> {
    try {
      // Validate LLM configuration
      this.validateLLMConfig(this.config.llmConfig);
      
      // Set default values
      this.config.maxConsecutiveAutoReply = this.config.maxConsecutiveAutoReply ?? 10;
      this.config.humanInputMode = this.config.humanInputMode ?? 'NEVER';
      
      this.isInitialized = true;
      
      this.emit('agent.created', {
        agent: this,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      throw new AgentCreationError(
        `Failed to initialize agent ${this.name}: ${error.message}`,
        { config: this.config, error }
      );
    }
  }

  /**
   * Generate a reply based on conversation messages
   */
  async generateReply(
    messages: ConversationMessage[],
    sender?: IAutoGenAgent
  ): Promise<ConversationMessage> {
    if (!this.isInitialized) {
      throw new ConversationError('Agent not initialized');
    }

    try {
      // Update conversation history
      this.conversationHistory.push(...messages);
      
      // Prepare the context for LLM
      const context = this.prepareContext(messages);
      
      // Check if we need to use tools
      const toolsContext = this.prepareToolsContext();
      
      // Generate response using LLM
      const response = await this.callLLM(context, toolsContext);
      
      // Process potential tool calls
      const processedResponse = await this.processToolCalls(response);
      
      // Create the message
      const message: ConversationMessage = {
        role: 'assistant',
        content: processedResponse,
        name: this.name,
        timestamp: new Date().toISOString(),
        agentId: this.name
      };
      
      // Add to conversation history
      this.conversationHistory.push(message);
      
      // Emit event
      this.emit('agent.messageGenerated', {
        agent: this,
        message,
        timestamp: new Date().toISOString()
      });
      
      return message;
      
    } catch (error) {
      const errorMessage = `Failed to generate reply: ${error.message}`;
      
      this.emit('error.occurred', {
        error: new Error(errorMessage),
        context: 'generateReply',
        agent: this,
        timestamp: new Date().toISOString()
      });
      
      throw new ConversationError(errorMessage, { messages, sender, error });
    }
  }

  /**
   * Receive a message from another agent
   */
  async receiveMessage(
    message: ConversationMessage,
    sender?: IAutoGenAgent
  ): Promise<void> {
    // Add message to conversation history
    this.conversationHistory.push(message);
    
    // Process the message if needed
    await this.processIncomingMessage(message, sender);
  }

  /**
   * Initialize a chat with another agent
   */
  async initializeChat(
    message: string,
    recipient: IAutoGenAgent
  ): Promise<ConversationMessage[]> {
    try {
      const initialMessage: ConversationMessage = {
        role: 'user',
        content: message,
        name: this.name,
        timestamp: new Date().toISOString(),
        agentId: this.name
      };
      
      // Send initial message to recipient
      await recipient.receiveMessage(initialMessage, this);
      
      // Get reply from recipient
      const reply = await recipient.generateReply([initialMessage], this);
      
      // Update our conversation history
      this.conversationHistory.push(initialMessage, reply);
      
      return [initialMessage, reply];
      
    } catch (error) {
      throw new ConversationError(
        `Failed to initialize chat: ${error.message}`,
        { message, recipient: recipient.name, error }
      );
    }
  }

  /**
   * Add a tool to the agent
   */
  addTool(tool: AutoGenTool): void {
    this.validateTool(tool);
    this.tools.set(tool.function.name, tool);
  }

  /**
   * Remove a tool from the agent
   */
  removeTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  /**
   * Update system message
   */
  updateSystemMessage(message: string): void {
    this.config.systemMessage = message;
  }

  /**
   * Update LLM configuration
   */
  updateLLMConfig(config: Partial<LLMConfig>): void {
    this.config.llmConfig = { ...this.config.llmConfig, ...config };
    this.validateLLMConfig(this.config.llmConfig);
  }

  /**
   * Get agent information
   */
  getAgentInfo(): {
    name: string;
    role: string;
    description: string;
    capabilities: string[];
  } {
    return {
      name: this.name,
      role: this.role,
      description: this.config.description || `AutoGen agent with role: ${this.role}`,
      capabilities: Array.from(this.tools.keys())
    };
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Private helper methods
   */

  private validateConfig(config: AutoGenAgentConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new AgentCreationError('Agent name is required and must be a string');
    }
    
    if (!config.role || typeof config.role !== 'string') {
      throw new AgentCreationError('Agent role is required and must be a string');
    }
    
    if (!config.systemMessage || typeof config.systemMessage !== 'string') {
      throw new AgentCreationError('System message is required and must be a string');
    }
    
    if (!config.llmConfig) {
      throw new AgentCreationError('LLM configuration is required');
    }
  }

  private validateLLMConfig(config: LLMConfig): void {
    if (!config.model || typeof config.model !== 'string') {
      throw new AgentCreationError('LLM model is required and must be a string');
    }
    
    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        throw new AgentCreationError('Temperature must be a number between 0 and 2');
      }
    }
    
    if (config.maxTokens !== undefined) {
      if (typeof config.maxTokens !== 'number' || config.maxTokens <= 0) {
        throw new AgentCreationError('Max tokens must be a positive number');
      }
    }
  }

  private validateTool(tool: AutoGenTool): void {
    if (!tool.function?.name || typeof tool.function.name !== 'string') {
      throw new AgentCreationError('Tool function name is required and must be a string');
    }
    
    if (!tool.function.description || typeof tool.function.description !== 'string') {
      throw new AgentCreationError('Tool function description is required and must be a string');
    }
    
    if (typeof tool.implementation !== 'function') {
      throw new AgentCreationError('Tool implementation must be a function');
    }
  }

  private prepareContext(messages: ConversationMessage[]): string {
    const context = [
      `System: ${this.config.systemMessage}`,
      '',
      'Conversation history:'
    ];
    
    // Add recent messages (limit to avoid token overflow)
    const recentMessages = messages.slice(-10);
    recentMessages.forEach(msg => {
      const speaker = msg.name || msg.role;
      context.push(`${speaker}: ${msg.content}`);
    });
    
    return context.join('\n');
  }

  private prepareToolsContext(): string {
    if (this.tools.size === 0) {
      return '';
    }
    
    const toolsInfo = Array.from(this.tools.values()).map(tool => {
      return `- ${tool.function.name}: ${tool.function.description}`;
    });
    
    return `\nAvailable tools:\n${toolsInfo.join('\n')}`;
  }

  private async callLLM(context: string, toolsContext: string): Promise<string> {
    // This is a simplified implementation
    // In a real implementation, this would call the actual LLM API
    
    const fullPrompt = context + toolsContext + '\n\nRespond as ' + this.role + ':';
    
    // Mock response for now - in real implementation, this would be an actual LLM call
    return `This is a mock response from ${this.name} (${this.role}). In a real implementation, this would be generated by the LLM based on the prompt: "${fullPrompt.substring(0, 100)}..."`;
  }

  private async processToolCalls(response: string): Promise<string> {
    // Check if response contains tool calls
    // This is a simplified implementation
    // In a real implementation, this would parse function calls and execute tools
    
    if (!response.includes('tool_call:')) {
      return response;
    }
    
    // Mock tool call processing
    return response.replace(/tool_call:(\w+)/g, (match, toolName) => {
      if (this.tools.has(toolName)) {
        return `[Tool ${toolName} executed successfully]`;
      }
      return `[Tool ${toolName} not found]`;
    });
  }

  private async processIncomingMessage(
    message: ConversationMessage,
    sender?: IAutoGenAgent
  ): Promise<void> {
    // Process incoming message if needed
    // This could include updating internal state, triggering actions, etc.
    
    // For now, just log the receipt
    console.log(`Agent ${this.name} received message from ${sender?.name || 'unknown'}: ${message.content.substring(0, 50)}...`);
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(
    toolName: string,
    args: any
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolExecutionError(`Tool ${toolName} not found`);
    }
    
    try {
      const startTime = Date.now();
      const result = await tool.implementation(args);
      const duration = Date.now() - startTime;
      
      this.emit('tool.executed', {
        agent: this,
        toolName,
        input: args,
        output: result,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Tool ${toolName} executed in ${duration}ms`);
      return result;
      
    } catch (error) {
      throw new ToolExecutionError(
        `Tool ${toolName} execution failed: ${error.message}`,
        { toolName, args, error }
      );
    }
  }
}