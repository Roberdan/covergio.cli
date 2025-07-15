/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  BaseCollaborationPattern, 
  AgentParticipation,
  TurnTakingRules
} from '../CollaborationPattern';
import { 
  CollaborationPattern, 
  ConversationMessage 
} from '../../types';

/**
 * Sequential collaboration pattern - agents take turns in a predefined order
 */
export class SequentialPattern extends BaseCollaborationPattern {
  private currentSpeakerIndex: number = 0;
  private roundCount: number = 0;
  private maxRounds: number;

  constructor(
    conversationId: string,
    participants: AgentParticipation[],
    rules: Partial<TurnTakingRules> = {},
    maxRounds: number = 3
  ) {
    super(conversationId, participants, rules);
    this.maxRounds = maxRounds;
    
    // Sort participants by priority for turn order
    this.state.participants.sort((a, b) => b.priority - a.priority);
  }

  getPatternType(): CollaborationPattern {
    return CollaborationPattern.SEQUENTIAL;
  }

  selectNextSpeaker(): AgentParticipation | null {
    if (this.state.participants.length === 0) {
      return null;
    }

    // Move to next agent in sequence
    this.currentSpeakerIndex = (this.currentSpeakerIndex + 1) % this.state.participants.length;
    
    // If we've completed a full round, increment round count
    if (this.currentSpeakerIndex === 0) {
      this.roundCount++;
    }

    return this.state.participants[this.currentSpeakerIndex];
  }

  shouldChangeSpeaker(message: ConversationMessage): boolean {
    if (!this.state.currentSpeaker) {
      return true;
    }

    const currentParticipant = this.getParticipant(this.state.currentSpeaker);
    if (!currentParticipant) {
      return true;
    }

    // Check if current agent has exceeded max consecutive turns
    const consecutiveTurns = this.getConsecutiveTurns(this.state.currentSpeaker);
    if (consecutiveTurns >= currentParticipant.maxConsecutiveTurns) {
      return true;
    }

    // In sequential pattern, generally change after each message
    // unless the agent explicitly requests to continue
    const continueKeywords = ['continue', 'more', 'also', 'additionally', 'furthermore'];
    const shouldContinue = continueKeywords.some(keyword => 
      message.content.toLowerCase().includes(keyword)
    );

    return !shouldContinue || consecutiveTurns >= currentParticipant.maxConsecutiveTurns;
  }

  /**
   * Count consecutive turns for an agent (from the end of history)
   */
  private getConsecutiveTurns(agentName: string): number {
    let count = 0;
    for (let i = this.state.history.length - 1; i >= 0; i--) {
      if (this.state.history[i].agent_id === agentName) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Override completion check to include round limits
   */
  protected isConversationComplete(): boolean {
    if (this.roundCount >= this.maxRounds) {
      return true;
    }

    return super.isConversationComplete();
  }

  /**
   * Get current round information
   */
  getCurrentRound(): { round: number, maxRounds: number, progress: number } {
    return {
      round: this.roundCount,
      maxRounds: this.maxRounds,
      progress: this.roundCount / this.maxRounds
    };
  }

  /**
   * Get the turn order
   */
  getTurnOrder(): string[] {
    return this.state.participants.map(p => p.agentName);
  }

  /**
   * Override to emit round completion events
   */
  async addMessage(message: ConversationMessage): Promise<void> {
    const previousRound = this.roundCount;
    await super.addMessage(message);
    
    // Check if round completed
    if (this.roundCount > previousRound) {
      this.emit('round-completed', {
        conversationId: this.state.id,
        completedRound: previousRound + 1,
        totalRounds: this.maxRounds,
        participants: this.getTurnOrder()
      });
    }
  }
}