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
 * Expert consultation request
 */
interface ConsultationRequest {
  id: string;
  requesterId: string;
  topic: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  requiredExpertise: string[];
  timestamp: Date;
  status: 'pending' | 'assigned' | 'in-progress' | 'resolved' | 'escalated';
}

/**
 * Expert response to consultation
 */
interface ExpertResponse {
  expertId: string;
  requestId: string;
  response: string;
  confidence: number;
  timestamp: Date;
  followUpNeeded: boolean;
  additionalExperts?: string[];
}

/**
 * Consultation session tracking
 */
interface ConsultationSession {
  requestId: string;
  assignedExperts: string[];
  responses: ExpertResponse[];
  consensus: boolean;
  finalRecommendation?: string;
  escalationNeeded: boolean;
}

/**
 * Consultation collaboration pattern - expert knowledge sharing and advice
 */
export class ConsultationPattern extends BaseCollaborationPattern {
  private consultationRequests: Map<string, ConsultationRequest> = new Map();
  private sessions: Map<string, ConsultationSession> = new Map();
  private activeRequest: string | null = null;
  private requester: string | null = null;

  constructor(
    conversationId: string,
    participants: AgentParticipation[],
    rules: Partial<TurnTakingRules> = {}
  ) {
    super(conversationId, participants, {
      allowConsecutiveTurns: true,
      interruptionPolicy: 'priority-based',
      maxTurnsPerAgent: 5,
      prioritizeExpertise: true,
      ...rules
    });

    // Identify requester (usually the first participant or one with 'requester' role)
    this.requester = participants.find(p => p.role === 'requester')?.agentName ||
                    participants[0]?.agentName || null;
  }

  getPatternType(): CollaborationPattern {
    return CollaborationPattern.CONSULTATION;
  }

  selectNextSpeaker(): AgentParticipation | null {
    // If no active request, requester should start
    if (!this.activeRequest) {
      return this.getParticipant(this.requester!) || null;
    }

    const session = this.sessions.get(this.activeRequest);
    if (!session) {
      return this.getParticipant(this.requester!) || null;
    }

    // Select expert who hasn't responded yet or needs follow-up
    const expertsNeedingResponse = session.assignedExperts.filter(expertId => {
      const hasResponded = session.responses.some(r => r.expertId === expertId);
      const needsFollowUp = session.responses.some(r => 
        r.expertId === expertId && r.followUpNeeded
      );
      return !hasResponded || needsFollowUp;
    });

    if (expertsNeedingResponse.length > 0) {
      // Prioritize by expertise match and priority
      const request = this.consultationRequests.get(this.activeRequest)!;
      const bestExpert = expertsNeedingResponse
        .map(expertId => ({
          expert: this.getParticipant(expertId)!,
          relevanceScore: this.calculateExpertiseRelevance(expertId, request.requiredExpertise)
        }))
        .sort((a, b) => {
          // Sort by relevance first, then by priority
          const relevanceDiff = b.relevanceScore - a.relevanceScore;
          if (relevanceDiff !== 0) return relevanceDiff;
          return b.expert.priority - a.expert.priority;
        })[0];

      return bestExpert?.expert || null;
    }

    // All experts have responded, check if consensus reached
    if (this.hasExpertConsensus(session)) {
      // Return to requester for acknowledgment
      return this.getParticipant(this.requester!) || null;
    }

    // Need more clarification - select expert with highest confidence
    const highestConfidenceExpert = session.responses
      .sort((a, b) => b.confidence - a.confidence)[0];
    
    return this.getParticipant(highestConfidenceExpert?.expertId) || null;
  }

  shouldChangeSpeaker(message: ConversationMessage): boolean {
    const isRequester = message.agent_id === this.requester;
    const session = this.activeRequest ? this.sessions.get(this.activeRequest) : null;

    // Requester can ask follow-up questions
    if (isRequester) {
      const isFollowUp = this.isFollowUpQuestion(message.content);
      return !isFollowUp;
    }

    // Experts should change speaker after providing response
    if (session && session.assignedExperts.includes(message.agent_id)) {
      const isComprehensiveResponse = this.isComprehensiveResponse(message.content);
      return isComprehensiveResponse;
    }

    return true;
  }

  /**
   * Create a new consultation request
   */
  async createConsultationRequest(
    topic: string,
    description: string,
    requiredExpertise: string[],
    urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<string> {
    const requestId = `consultation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const request: ConsultationRequest = {
      id: requestId,
      requesterId: this.requester!,
      topic,
      description,
      urgency,
      requiredExpertise,
      timestamp: new Date(),
      status: 'pending'
    };

    this.consultationRequests.set(requestId, request);
    this.activeRequest = requestId;

    // Assign experts based on required expertise
    const assignedExperts = this.assignExperts(requiredExpertise);
    
    const session: ConsultationSession = {
      requestId,
      assignedExperts,
      responses: [],
      consensus: false,
      escalationNeeded: false
    };

    this.sessions.set(requestId, session);

    this.emit('consultation-created', {
      conversationId: this.state.id,
      request,
      assignedExperts
    });

    return requestId;
  }

  /**
   * Add expert response to consultation
   */
  async addExpertResponse(
    expertId: string,
    response: string,
    confidence: number,
    followUpNeeded: boolean = false,
    additionalExperts: string[] = []
  ): Promise<void> {
    if (!this.activeRequest) return;

    const session = this.sessions.get(this.activeRequest);
    if (!session) return;

    const expertResponse: ExpertResponse = {
      expertId,
      requestId: this.activeRequest,
      response,
      confidence,
      timestamp: new Date(),
      followUpNeeded,
      additionalExperts
    };

    session.responses.push(expertResponse);

    // Add additional experts if suggested
    if (additionalExperts.length > 0) {
      session.assignedExperts.push(...additionalExperts);
    }

    // Check for consensus
    session.consensus = this.hasExpertConsensus(session);

    this.emit('expert-response-added', {
      conversationId: this.state.id,
      response: expertResponse,
      consensusReached: session.consensus
    });
  }

  /**
   * Assign experts based on required expertise
   */
  private assignExperts(requiredExpertise: string[]): string[] {
    const experts = this.state.participants
      .filter(p => p.role === 'specialist' || p.role === 'participant')
      .filter(p => p.agentName !== this.requester);

    const assigned: string[] = [];

    for (const expertise of requiredExpertise) {
      const matchingExperts = experts
        .filter(expert => this.hasExpertise(expert, expertise))
        .sort((a, b) => b.priority - a.priority);

      if (matchingExperts.length > 0 && !assigned.includes(matchingExperts[0].agentName)) {
        assigned.push(matchingExperts[0].agentName);
      }
    }

    // Ensure at least one expert is assigned
    if (assigned.length === 0 && experts.length > 0) {
      assigned.push(experts.sort((a, b) => b.priority - a.priority)[0].agentName);
    }

    return assigned;
  }

  /**
   * Check if agent has specific expertise
   */
  private hasExpertise(agent: AgentParticipation, expertise: string): boolean {
    return agent.specializations?.some(spec => 
      spec.toLowerCase().includes(expertise.toLowerCase())
    ) || false;
  }

  /**
   * Calculate expertise relevance score
   */
  private calculateExpertiseRelevance(expertId: string, requiredExpertise: string[]): number {
    const expert = this.getParticipant(expertId);
    if (!expert || !expert.specializations) return 0;

    let relevanceScore = 0;
    for (const required of requiredExpertise) {
      for (const specialization of expert.specializations) {
        if (specialization.toLowerCase().includes(required.toLowerCase())) {
          relevanceScore += 1;
        }
      }
    }

    return relevanceScore / requiredExpertise.length;
  }

  /**
   * Check if expert consensus has been reached
   */
  private hasExpertConsensus(session: ConsultationSession): boolean {
    if (session.responses.length < 2) return false;

    // Check if responses are similar or complementary
    const avgConfidence = session.responses.reduce((sum, r) => sum + r.confidence, 0) / session.responses.length;
    
    // Consider consensus if average confidence is high and no major conflicts
    return avgConfidence >= 0.7 && !this.hasConflictingResponses(session.responses);
  }

  /**
   * Check for conflicting expert responses
   */
  private hasConflictingResponses(responses: ExpertResponse[]): boolean {
    // Simple conflict detection based on contradictory keywords
    const conflictKeywords = [
      'disagree', 'incorrect', 'wrong', 'not true', 'opposite',
      'contradicts', 'conflicts', 'different view'
    ];

    for (const response of responses) {
      if (conflictKeywords.some(keyword => 
        response.response.toLowerCase().includes(keyword)
      )) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if message is a follow-up question
   */
  private isFollowUpQuestion(content: string): boolean {
    const questionWords = ['how', 'what', 'when', 'where', 'why', 'which', 'who'];
    const followUpPhrases = [
      'can you explain', 'could you clarify', 'what about',
      'follow up', 'additional question', 'more details'
    ];

    const hasQuestionMark = content.includes('?');
    const hasQuestionWord = questionWords.some(word => 
      content.toLowerCase().includes(word)
    );
    const hasFollowUpPhrase = followUpPhrases.some(phrase => 
      content.toLowerCase().includes(phrase)
    );

    return hasQuestionMark || hasQuestionWord || hasFollowUpPhrase;
  }

  /**
   * Check if response is comprehensive
   */
  private isComprehensiveResponse(content: string): boolean {
    const comprehensiveIndicators = [
      'in conclusion', 'to summarize', 'my recommendation',
      'final answer', 'complete response', 'hope this helps'
    ];

    return comprehensiveIndicators.some(indicator => 
      content.toLowerCase().includes(indicator)
    ) || content.length > 200; // Long responses are likely comprehensive
  }

  /**
   * Get consultation status
   */
  getConsultationStatus(): {
    activeRequest: ConsultationRequest | null;
    session: ConsultationSession | null;
    pendingExperts: string[];
    consensusReached: boolean;
  } {
    const request = this.activeRequest ? this.consultationRequests.get(this.activeRequest) : null;
    const session = this.activeRequest ? this.sessions.get(this.activeRequest) : null;
    
    const pendingExperts = session ? session.assignedExperts.filter(expertId => 
      !session.responses.some(r => r.expertId === expertId)
    ) : [];

    return {
      activeRequest: request,
      session,
      pendingExperts,
      consensusReached: session?.consensus || false
    };
  }

  /**
   * Generate final recommendation
   */
  generateFinalRecommendation(): string | null {
    if (!this.activeRequest) return null;

    const session = this.sessions.get(this.activeRequest);
    if (!session || session.responses.length === 0) return null;

    // Combine expert responses into a coherent recommendation
    const responses = session.responses
      .sort((a, b) => b.confidence - a.confidence);

    const mainResponse = responses[0];
    const supportingPoints = responses.slice(1)
      .map(r => `• ${r.response.substring(0, 100)}...`)
      .join('\n');

    const recommendation = `
Primary Recommendation (Confidence: ${Math.round(mainResponse.confidence * 100)}%):
${mainResponse.response}

${supportingPoints ? `\nSupporting Expert Input:\n${supportingPoints}` : ''}

Consensus Status: ${session.consensus ? 'Reached' : 'Partial agreement'}
`;

    session.finalRecommendation = recommendation;
    return recommendation;
  }

  /**
   * Override completion check for consultation-specific logic
   */
  protected isConversationComplete(): boolean {
    const session = this.activeRequest ? this.sessions.get(this.activeRequest) : null;
    
    if (session) {
      // Complete if consensus reached and requester has acknowledged
      if (session.consensus) {
        const requesterAcknowledged = this.state.history.some(msg => 
          msg.agent_id === this.requester && 
          ['thank', 'thanks', 'understood', 'clear', 'resolved'].some(word =>
            msg.content.toLowerCase().includes(word)
          )
        );
        return requesterAcknowledged;
      }

      // Complete if all experts have responded and no follow-up needed
      const allResponded = session.assignedExperts.every(expertId =>
        session.responses.some(r => r.expertId === expertId)
      );
      const noFollowUpNeeded = !session.responses.some(r => r.followUpNeeded);
      
      if (allResponded && noFollowUpNeeded) {
        return true;
      }
    }

    return super.isConversationComplete();
  }
}