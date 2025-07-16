/**
 * Agent-related types for the RAG system
 */

import { SourceReference } from './core.js';
import { QueryOptions } from './config.js';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  personality: AgentPersonality;
  knowledgeBases: string[];
  settings: AgentSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentPersonality {
  tone: 'professional' | 'casual' | 'friendly' | 'technical' | 'creative';
  verbosity: 'concise' | 'detailed' | 'comprehensive';
  expertise: string[];
  responseStyle: 'direct' | 'explanatory' | 'conversational';
  customTraits?: Record<string, any>;
}

export interface AgentSettings {
  maxResponseLength: number;
  temperature: number;
  topK: number;
  contextWindow: number;
  enableSourceCitation: boolean;
  confidenceThreshold: number;
}

export interface AgentResponse {
  answer: string;
  sources: SourceReference[];
  confidence: number;
  processingTime: number;
  tokensUsed: number;
  metadata?: Record<string, any>;
}

export interface AgentSummary {
  id: string;
  name: string;
  description: string;
  knowledgeBaseCount: number;
  createdAt: Date;
  lastUsed?: Date;
  queryCount: number;
}

export interface RAGAgent {
  id: string;
  config: AgentConfig;
  query(question: string, options?: QueryOptions): Promise<AgentResponse>;
  addKnowledgeBase(kbId: string): Promise<void>;
  removeKnowledgeBase(kbId: string): Promise<void>;
  updateConfig(updates: Partial<AgentConfig>): Promise<void>;
  getStats(): Promise<AgentStats>;
}

export interface AgentStats {
  totalQueries: number;
  averageResponseTime: number;
  averageConfidence: number;
  lastUsed?: Date;
  knowledgeBaseStats: KnowledgeBaseUsageStats[];
}

export interface KnowledgeBaseUsageStats {
  knowledgeBaseId: string;
  queriesCount: number;
  averageRelevance: number;
}