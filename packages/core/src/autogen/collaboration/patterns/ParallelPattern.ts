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
 * Work assignment for parallel execution
 */
interface WorkAssignment {
  agentName: string;
  taskDescription: string;
  priority: number;
  estimatedDuration: number;
  dependencies: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: any;
}

/**
 * Parallel collaboration pattern - agents work simultaneously on different aspects
 */
export class ParallelPattern extends BaseCollaborationPattern {
  private workAssignments: Map<string, WorkAssignment> = new Map();
  private completedWork: Map<string, any> = new Map();
  private integrationPhase: boolean = false;
  private moderator: string | null = null;

  constructor(
    conversationId: string,
    participants: AgentParticipation[],
    rules: Partial<TurnTakingRules> = {}
  ) {
    super(conversationId, participants, {
      allowConsecutiveTurns: true,
      interruptionPolicy: 'all-agents',
      maxTurnsPerAgent: 10,
      ...rules
    });

    // Find moderator (highest priority agent with moderator role)
    this.moderator = participants
      .filter(p => p.role === 'moderator')
      .sort((a, b) => b.priority - a.priority)[0]?.agentName || null;
  }

  getPatternType(): CollaborationPattern {
    return CollaborationPattern.PARALLEL;
  }

  selectNextSpeaker(): AgentParticipation | null {
    // During integration phase, prioritize moderator
    if (this.integrationPhase && this.moderator) {
      const moderatorParticipant = this.getParticipant(this.moderator);
      if (moderatorParticipant) {
        return moderatorParticipant;
      }
    }

    // Select agent with highest priority work or least recent activity
    const availableAgents = this.state.participants.filter(p => {
      const assignment = this.workAssignments.get(p.agentName);
      return !assignment || assignment.status !== 'completed';
    });

    if (availableAgents.length === 0) {
      // All work completed, start integration
      this.startIntegrationPhase();
      return this.getParticipant(this.moderator || this.state.participants[0].agentName) || null;
    }

    // Select agent with highest priority incomplete work
    const agentWithWork = availableAgents
      .map(agent => ({
        agent,
        assignment: this.workAssignments.get(agent.agentName),
        lastActivity: this.getLastActivityTime(agent.agentName)
      }))
      .sort((a, b) => {
        // Prioritize by assignment priority, then by staleness
        const priorityDiff = (b.assignment?.priority || 0) - (a.assignment?.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        return a.lastActivity - b.lastActivity; // Earlier activity = higher priority
      })[0];

    return agentWithWork?.agent || availableAgents[0];
  }

  shouldChangeSpeaker(message: ConversationMessage): boolean {
    // In parallel pattern, agents can continue working on their assignments
    if (!this.integrationPhase) {
      const assignment = this.workAssignments.get(message.agent_id);
      if (assignment && assignment.status === 'in-progress') {
        // Check if work is complete based on message content
        const completionKeywords = [
          'completed', 'finished', 'done', 'ready', 'result',
          'final', 'conclusion', 'summary'
        ];
        
        const isComplete = completionKeywords.some(keyword =>
          message.content.toLowerCase().includes(keyword)
        );

        if (isComplete) {
          this.markWorkCompleted(message.agent_id, message.content);
          return true;
        }

        // Allow continued work if not complete
        const consecutiveTurns = this.getConsecutiveTurns(message.agent_id);
        const participant = this.getParticipant(message.agent_id);
        return consecutiveTurns >= (participant?.maxConsecutiveTurns || 3);
      }
    }

    // During integration phase, moderate turn-taking
    if (this.integrationPhase) {
      return message.agent_id !== this.moderator;
    }

    return true;
  }

  /**
   * Assign work to agents
   */
  async assignWork(assignments: Omit<WorkAssignment, 'status'>[]): Promise<void> {
    for (const assignment of assignments) {
      this.workAssignments.set(assignment.agentName, {
        ...assignment,
        status: 'pending'
      });
    }

    this.emit('work-assigned', {
      conversationId: this.state.id,
      assignments: Array.from(this.workAssignments.values())
    });

    // Notify agents of their assignments
    for (const assignment of assignments) {
      await this.addMessage({
        role: 'system',
        content: `Assignment for ${assignment.agentName}: ${assignment.taskDescription}`,
        timestamp: new Date().toISOString(),
        agent_id: 'system',
        metadata: { assignment }
      });
    }
  }

  /**
   * Mark work as completed by an agent
   */
  private markWorkCompleted(agentName: string, result: string): void {
    const assignment = this.workAssignments.get(agentName);
    if (assignment) {
      assignment.status = 'completed';
      assignment.result = result;
      this.completedWork.set(agentName, result);

      this.emit('work-completed', {
        conversationId: this.state.id,
        agentName,
        assignment,
        result
      });
    }
  }

  /**
   * Start the integration phase
   */
  private startIntegrationPhase(): void {
    if (this.integrationPhase) return;

    this.integrationPhase = true;
    this.emit('integration-phase-started', {
      conversationId: this.state.id,
      completedWork: Array.from(this.completedWork.entries()),
      moderator: this.moderator
    });
  }

  /**
   * Get work assignments
   */
  getWorkAssignments(): WorkAssignment[] {
    return Array.from(this.workAssignments.values());
  }

  /**
   * Get completed work
   */
  getCompletedWork(): Record<string, any> {
    return Object.fromEntries(this.completedWork);
  }

  /**
   * Get work progress
   */
  getProgress(): {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    percentage: number;
  } {
    const assignments = Array.from(this.workAssignments.values());
    const total = assignments.length;
    const completed = assignments.filter(a => a.status === 'completed').length;
    const inProgress = assignments.filter(a => a.status === 'in-progress').length;
    const pending = assignments.filter(a => a.status === 'pending').length;

    return {
      total,
      completed,
      inProgress,
      pending,
      percentage: total > 0 ? (completed / total) * 100 : 0
    };
  }

  /**
   * Check if all work is completed
   */
  private isAllWorkCompleted(): boolean {
    return Array.from(this.workAssignments.values())
      .every(assignment => assignment.status === 'completed');
  }

  /**
   * Get last activity time for an agent
   */
  private getLastActivityTime(agentName: string): number {
    const lastMessage = this.state.history
      .reverse()
      .find(msg => msg.agent_id === agentName);
    
    return lastMessage ? new Date(lastMessage.timestamp).getTime() : 0;
  }

  /**
   * Count consecutive turns for an agent
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
   * Override completion check to include work completion
   */
  protected isConversationComplete(): boolean {
    if (this.integrationPhase && this.hasConsensus()) {
      return true;
    }

    return super.isConversationComplete();
  }

  /**
   * Override to handle integration completion
   */
  async addMessage(message: ConversationMessage): Promise<void> {
    // Check if this message starts work on an assignment
    const assignment = this.workAssignments.get(message.agent_id);
    if (assignment && assignment.status === 'pending') {
      assignment.status = 'in-progress';
      this.emit('work-started', {
        conversationId: this.state.id,
        agentName: message.agent_id,
        assignment
      });
    }

    await super.addMessage(message);

    // Auto-start integration if all work is completed
    if (!this.integrationPhase && this.isAllWorkCompleted()) {
      this.startIntegrationPhase();
    }
  }
}