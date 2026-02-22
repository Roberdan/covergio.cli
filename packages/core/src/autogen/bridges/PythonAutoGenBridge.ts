/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  AutoGenAgentConfig,
  ConversationMessage,
  GroupChatConfig,
  AutoGenEvents,
  AutoGenAgent,
  AgentBridge,
  BridgeError,
  AgentCreationError,
  ConversationError
} from '../types';
import { AgentDefinition, AgentCapability, AgentPersonality, IAgent } from '../../universal/agents/types';

/**
 * Configuration for the Python AutoGen Bridge
 */
export interface PythonBridgeConfig {
  pythonServerHost: string;
  pythonServerPort: number;
  httpPort: number;
  enableWebSocket: boolean;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Bridge client for connecting TypeScript to Python AutoGen
 */
export class PythonAutoGenBridge extends EventEmitter implements AgentBridge {
  private config: PythonBridgeConfig;
  private websocket: WebSocket | null = null;
  private httpBaseUrl: string;
  private websocketUrl: string;
  private clientId: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private messageId: number = 0;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: Partial<PythonBridgeConfig> = {}) {
    super();
    
    this.config = {
      pythonServerHost: config.pythonServerHost || 'localhost',
      pythonServerPort: config.pythonServerPort || 8765,
      httpPort: config.httpPort || 8766,
      enableWebSocket: config.enableWebSocket !== false,
      connectionTimeout: config.connectionTimeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000
    };
    
    this.httpBaseUrl = `http://${this.config.pythonServerHost}:${this.config.httpPort}`;
    this.websocketUrl = `ws://${this.config.pythonServerHost}:${this.config.pythonServerPort}`;
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize the bridge connection
   */
  async initialize(): Promise<void> {
    try {
      // Test HTTP connection first
      await this.testHttpConnection();
      
      // Initialize WebSocket if enabled
      if (this.config.enableWebSocket) {
        await this.connectWebSocket();
      }
      
      this.emit('connected', { timestamp: new Date().toISOString() });
      
    } catch (error) {
      throw new BridgeError(
        `Failed to initialize Python AutoGen bridge: ${error.message}`,
        { config: this.config, error }
      );
    }
  }

  /**
   * Test HTTP connection to Python server
   */
  private async testHttpConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.httpBaseUrl}/agents`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.config.connectionTimeout)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      throw new BridgeError(
        `Cannot connect to Python AutoGen server at ${this.httpBaseUrl}`,
        { error }
      );
    }
  }

  /**
   * Connect WebSocket for real-time communication
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.websocketUrl}/ws/${this.clientId}`;
      
      try {
        this.websocket = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          reject(new BridgeError('WebSocket connection timeout'));
        }, this.config.connectionTimeout);
        
        this.websocket.on('open', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log(`WebSocket connected to ${wsUrl}`);
          resolve();
        });
        
        this.websocket.on('message', (data: WebSocket.Data) => {
          this.handleWebSocketMessage(data.toString());
        });
        
        this.websocket.on('close', () => {
          this.isConnected = false;
          console.log('WebSocket connection closed');
          this.handleWebSocketClose();
        });
        
        this.websocket.on('error', (error) => {
          clearTimeout(timeout);
          this.isConnected = false;
          console.error('WebSocket error:', error);
          reject(new BridgeError(`WebSocket error: ${error.message}`));
        });
        
      } catch (error) {
        reject(new BridgeError(`Failed to create WebSocket: ${error.message}`));
      }
    });
  }

  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Handle response to pending request
      if (message.request_id && this.pendingRequests.has(message.request_id)) {
        const request = this.pendingRequests.get(message.request_id)!;
        clearTimeout(request.timeout);
        this.pendingRequests.delete(message.request_id);
        
        if (message.success) {
          request.resolve(message.data);
        } else {
          request.reject(new Error(message.error || 'Unknown error'));
        }
        return;
      }
      
      // Handle event messages
      this.handleEventMessage(message);
      
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle event messages from Python
   */
  private handleEventMessage(message: any): void {
    const eventType = message.type;
    
    switch (eventType) {
      case 'agent_created':
        this.emit('agent.created', {
          agent: message.data.agent,
          timestamp: new Date().toISOString()
        } as AutoGenEvents['agent.created']);
        break;
        
      case 'conversation_started':
        this.emit('groupChat.started', {
          groupChat: message.data.groupChat,
          initiator: message.data.initiator,
          timestamp: new Date().toISOString()
        } as AutoGenEvents['groupChat.started']);
        break;
        
      case 'conversation_message':
        this.emit('agent.messageGenerated', {
          agent: message.data.agent,
          message: message.data.message,
          timestamp: new Date().toISOString()
        } as AutoGenEvents['agent.messageGenerated']);
        break;
        
      case 'error':
        this.emit('error.occurred', {
          error: new Error(message.data.error),
          context: message.data.context || 'Unknown',
          timestamp: new Date().toISOString()
        } as AutoGenEvents['error.occurred']);
        break;
    }
  }

  /**
   * Handle WebSocket close
   */
  private handleWebSocketClose(): void {
    if (this.reconnectAttempts < this.config.retryAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect WebSocket (attempt ${this.reconnectAttempts}/${this.config.retryAttempts})`);
      
      setTimeout(() => {
        this.connectWebSocket().catch(error => {
          console.error('WebSocket reconnection failed:', error);
        });
      }, this.config.retryDelay);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
      this.emit('disconnected', { reason: 'Max reconnection attempts reached' });
    }
  }

  /**
   * Send WebSocket message with response handling
   */
  private async sendWebSocketMessage(message: any): Promise<any> {
    if (!this.websocket || !this.isConnected) {
      throw new BridgeError('WebSocket not connected');
    }
    
    const requestId = `req_${this.messageId++}_${Date.now()}`;
    message.request_id = requestId;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new BridgeError('Request timeout'));
      }, this.config.connectionTimeout);
      
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      
      this.websocket!.send(JSON.stringify(message));
    });
  }

  /**
   * Create an AutoGen agent via Python bridge
   */
  async createAgent(config: AutoGenAgentConfig): Promise<void> {
    try {
      if (this.config.enableWebSocket && this.isConnected) {
        // Use WebSocket for real-time communication
        await this.sendWebSocketMessage({
          type: 'create_agent',
          data: config
        });
      } else {
        // Use HTTP API
        const response = await fetch(`${this.httpBaseUrl}/agents/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to create agent');
        }
      }
      
    } catch (error) {
      throw new AgentCreationError(
        `Failed to create agent ${config.name}: ${error.message}`,
        { config, error }
      );
    }
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<Array<{
    name: string;
    role: string;
    description: string;
  }>> {
    try {
      if (this.config.enableWebSocket && this.isConnected) {
        const result = await this.sendWebSocketMessage({ type: 'list_agents' });
        return result.agents;
      } else {
        const response = await fetch(`${this.httpBaseUrl}/agents`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return data.agents;
      }
    } catch (error) {
      throw new BridgeError(`Failed to list agents: ${error.message}`);
    }
  }

  /**
   * Start a conversation between two agents
   */
  async startConversation(
    initiator: string,
    recipient: string,
    message: string,
    maxTurns: number = 10
  ): Promise<ConversationMessage[]> {
    try {
      const conversationData = {
        initiator,
        recipient,
        message,
        max_turns: maxTurns
      };
      
      if (this.config.enableWebSocket && this.isConnected) {
        const result = await this.sendWebSocketMessage({
          type: 'start_conversation',
          data: conversationData
        });
        return result.conversation;
      } else {
        const response = await fetch(`${this.httpBaseUrl}/conversations/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conversationData)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to start conversation');
        }
        
        const data = await response.json();
        return data.conversation;
      }
    } catch (error) {
      throw new ConversationError(
        `Failed to start conversation: ${error.message}`,
        { initiator, recipient, message, error }
      );
    }
  }

  /**
   * Create a group chat
   */
  async createGroupChat(config: GroupChatConfig): Promise<string> {
    try {
      const response = await fetch(`${this.httpBaseUrl}/groupchats/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create group chat');
      }
      
      const data = await response.json();
      return data.chat_id;
      
    } catch (error) {
      throw new ConversationError(
        `Failed to create group chat: ${error.message}`,
        { config, error }
      );
    }
  }

  /**
   * Convert Universal Agent definition to AutoGen config
   */
  convertToAutoGen(definition: AgentDefinition): AutoGenAgentConfig {
    return {
      name: definition.role,
      role: definition.role,
      system_message: this.mapPersonality(definition.personality),
      llm_config: {
        model: 'gpt-4',  // Default model
        temperature: 0.7,
        max_tokens: 2000
      },
      tools: this.mapCapabilities(definition.capabilities),
      description: definition.description || `Agent with role: ${definition.role}`
    };
  }

  /**
   * Convert AutoGen config to Universal Agent definition
   */
  convertFromAutoGen(config: AutoGenAgentConfig): AgentDefinition {
    return {
      role: config.role,
      description: config.description || '',
      capabilities: [], // Would need reverse mapping
      personality: {
        traits: [],
        communicationStyle: 'professional',
        expertise: [],
        approach: 'analytical'
      },
      temperature: config.llm_config.temperature || 0.7,
      maxTokens: config.llm_config.max_tokens || 2000
    };
  }

  /**
   * Map capabilities to AutoGen tools
   */
  mapCapabilities(capabilities: AgentCapability[]): any[] {
    return capabilities.map(cap => ({
      type: 'function',
      function: {
        name: cap.name,
        description: cap.description,
        parameters: cap.parameters || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  }

  /**
   * Map personality to system message
   */
  mapPersonality(personality: AgentPersonality): string {
    let systemMessage = `You are an AI assistant with the following characteristics:\n`;
    
    if (personality.traits.length > 0) {
      systemMessage += `\nPersonality traits: ${personality.traits.join(', ')}\n`;
    }
    
    if (personality.expertise.length > 0) {
      systemMessage += `\nExpertise areas: ${personality.expertise.join(', ')}\n`;
    }
    
    systemMessage += `\nCommunication style: ${personality.communicationStyle}\n`;
    systemMessage += `\nApproach: ${personality.approach}\n`;
    
    return systemMessage;
  }

  /**
   * Synchronize state between systems
   */
  async synchronizeState(universalAgent: IAgent, autoGenAgent: AutoGenAgent): Promise<void> {
    // Implementation for state synchronization
    // This would keep both systems in sync
  }

  /**
   * Close the bridge connection
   */
  async close(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.isConnected = false;
    
    // Clear pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Bridge connection closed'));
    }
    this.pendingRequests.clear();
    
    this.emit('disconnected', { reason: 'Manual close' });
  }

  /**
   * Check if bridge is connected
   */
  isConnectedToPython(): boolean {
    return this.isConnected;
  }

  /**
   * Get bridge status
   */
  getStatus(): {
    connected: boolean;
    httpUrl: string;
    websocketUrl: string;
    clientId: string;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      httpUrl: this.httpBaseUrl,
      websocketUrl: this.websocketUrl,
      clientId: this.clientId,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}