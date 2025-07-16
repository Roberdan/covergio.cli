/**
 * Agent management interfaces for the RAG system
 */

import { 
  AgentConfig, 
  RAGAgent, 
  AgentSummary, 
  AgentResponse,
  QueryOptions 
} from '../types/index.js';

export interface IAgentManager {
  /**
   * Create a new agent
   */
  createAgent(config: AgentConfig): Promise<RAGAgent>;
  
  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Promise<RAGAgent | null>;
  
  /**
   * List all agents
   */
  listAgents(): Promise<AgentSummary[]>;
  
  /**
   * Update an agent configuration
   */
  updateAgent(agentId: string, updates: Partial<AgentConfig>): Promise<void>;
  
  /**
   * Delete an agent
   */
  deleteAgent(agentId: string): Promise<void>;
  
  /**
   * Validate agent configuration
   */
  validateConfig(config: AgentConfig): Promise<boolean>;
}

export interface IQueryEngine {
  /**
   * Process a query with an agent
   */
  processQuery(
    query: string, 
    agent: RAGAgent, 
    options?: QueryOptions
  ): Promise<AgentResponse>;
  
  /**
   * Get query suggestions based on knowledge base
   */
  getSuggestions(agentId: string, partialQuery: string): Promise<string[]>;
  
  /**
   * Explain query results
   */
  explainResults(response: AgentResponse): Promise<string>;
}