/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Base collaboration pattern
export {
  BaseCollaborationPattern,
  AgentParticipation,
  TurnTakingRules,
  ConversationState,
  CollaborationOutcome
} from './CollaborationPattern';

// Specific collaboration patterns
export { SequentialPattern } from './patterns/SequentialPattern';
export { ParallelPattern } from './patterns/ParallelPattern';
export { DebatePattern } from './patterns/DebatePattern';
export { ConsultationPattern } from './patterns/ConsultationPattern';
export { BrainstormPattern } from './patterns/BrainstormPattern';

// Group chat management
export {
  GroupChatManager,
  GroupChatConfig
} from './GroupChatManager';

// Re-export collaboration pattern enum from types
export { CollaborationPattern } from '../types';