/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Re-export types from core package for CLI use
export type { AgentInstance } from '../../../core/src/universal/types/common.js';
export type { ConversationTurn } from '../../../core/src/autogen/visualization/ConversationHistory.js';
import { ConversationMessage as BaseConversationMessage } from '../../../core/src/autogen/types.js';

// Extended ConversationMessage with UI-specific properties
export interface ConversationMessage extends BaseConversationMessage {
  type?: string;
  metadata?: {
    toolsUsed?: string[];
    responseTime?: number;
    contextReferences?: string[];
    patternPhase?: string;
    tokenCount?: number;
  };
}
export { CollaborationPattern } from '../../../core/src/autogen/types.js';

// Agent UI specific types
export interface TaskDependency {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
}

export interface ConversationBranch {
  id: string;
  parentTurnId: string;
  agentId: string;
  turns: any[]; // Use any[] to avoid circular dependency issues
  status: 'active' | 'completed' | 'merged' | 'abandoned';
}

// Message metadata for UI display
export interface MessageMetadata {
  toolsUsed?: string[];
  responseTime?: number;
  contextReferences?: string[];
  patternPhase?: string;
  tokenCount?: number;
}