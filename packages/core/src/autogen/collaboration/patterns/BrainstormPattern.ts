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
 * Brainstorming idea
 */
interface Idea {
  id: string;
  author: string;
  content: string;
  category: string;
  novelty: number; // 0-1 scale
  feasibility: number; // 0-1 scale
  impact: number; // 0-1 scale
  votes: number;
  buildUponCount: number;
  timestamp: Date;
  parentIdeaId?: string;
  tags: string[];
}

/**
 * Brainstorming phase
 */
type BrainstormPhase = 'ideation' | 'building' | 'evaluation' | 'selection' | 'refinement';

/**
 * Evaluation criteria
 */
interface EvaluationCriteria {
  novelty: number; // Weight for novelty
  feasibility: number; // Weight for feasibility
  impact: number; // Weight for impact
  alignment: number; // Weight for goal alignment
}

/**
 * Brainstorm session statistics
 */
interface BrainstormStats {
  totalIdeas: number;
  uniqueCategories: number;
  averageNovelty: number;
  averageFeasibility: number;
  averageImpact: number;
  topContributor: string;
  mostPopularIdea: Idea | null;
  participationRate: Record<string, number>;
}

/**
 * Brainstorm collaboration pattern - creative ideation and development
 */
export class BrainstormPattern extends BaseCollaborationPattern {
  private ideas: Map<string, Idea> = new Map();
  private currentPhase: BrainstormPhase = 'ideation';
  private facilitator: string | null = null;
  private topic: string = '';
  private goals: string[] = [];
  private evaluationCriteria: EvaluationCriteria = {
    novelty: 0.3,
    feasibility: 0.3,
    impact: 0.3,
    alignment: 0.1
  };
  private phaseTimeouts: Map<BrainstormPhase, number> = new Map([
    ['ideation', 300000], // 5 minutes
    ['building', 240000], // 4 minutes
    ['evaluation', 180000], // 3 minutes
    ['selection', 120000], // 2 minutes
    ['refinement', 180000] // 3 minutes
  ]);
  private phaseStartTime: Date = new Date();

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

    // Find facilitator
    this.facilitator = participants
      .filter(p => p.role === 'moderator')
      .sort((a, b) => b.priority - a.priority)[0]?.agentName || 
      participants.sort((a, b) => b.priority - a.priority)[0]?.agentName || null;
  }

  getPatternType(): CollaborationPattern {
    return CollaborationPattern.BRAINSTORM;
  }

  selectNextSpeaker(): AgentParticipation | null {
    switch (this.currentPhase) {
      case 'ideation':
        return this.selectForIdeation();
      
      case 'building':
        return this.selectForBuilding();
      
      case 'evaluation':
        return this.selectForEvaluation();
      
      case 'selection':
        return this.selectForSelection();
      
      case 'refinement':
        return this.selectForRefinement();
      
      default:
        return null;
    }
  }

  shouldChangeSpeaker(message: ConversationMessage): boolean {
    // In brainstorming, encourage rapid idea sharing
    if (this.currentPhase === 'ideation' || this.currentPhase === 'building') {
      // Allow continued ideation if agent is on a roll
      const recentIdeas = this.getRecentIdeasByAgent(message.agent_id, 3);
      if (recentIdeas.length >= 3) {
        return true; // Give others a chance
      }
      
      // Check if message contains multiple ideas
      const ideaCount = this.countIdeasInMessage(message.content);
      return ideaCount < 2; // Continue if only one idea, change if multiple
    }

    // In evaluation phases, enforce turn-taking
    if (this.currentPhase === 'evaluation' || this.currentPhase === 'selection') {
      return true;
    }

    return false;
  }

  /**
   * Initialize brainstorm session with topic and goals
   */
  async initializeBrainstorm(topic: string, goals: string[]): Promise<void> {
    this.topic = topic;
    this.goals = goals;
    this.phaseStartTime = new Date();

    await this.addMessage({
      role: 'system',
      content: `Starting brainstorm session on: ${topic}\nGoals: ${goals.join(', ')}`,
      timestamp: new Date().toISOString(),
      agent_id: 'system'
    });

    this.emit('brainstorm-initialized', {
      conversationId: this.state.id,
      topic,
      goals,
      phase: this.currentPhase
    });
  }

  /**
   * Add a new idea to the brainstorm
   */
  async addIdea(
    author: string,
    content: string,
    category: string = 'general',
    parentIdeaId?: string
  ): Promise<string> {
    const ideaId = `idea-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const idea: Idea = {
      id: ideaId,
      author,
      content,
      category,
      novelty: this.calculateNovelty(content),
      feasibility: this.calculateFeasibility(content),
      impact: this.calculateImpact(content),
      votes: 0,
      buildUponCount: 0,
      timestamp: new Date(),
      parentIdeaId,
      tags: this.extractTags(content)
    };

    this.ideas.set(ideaId, idea);

    // Update parent idea build-upon count
    if (parentIdeaId) {
      const parentIdea = this.ideas.get(parentIdeaId);
      if (parentIdea) {
        parentIdea.buildUponCount++;
      }
    }

    this.emit('idea-added', {
      conversationId: this.state.id,
      idea,
      phase: this.currentPhase
    });

    return ideaId;
  }

  /**
   * Vote for an idea
   */
  async voteForIdea(ideaId: string, voterAgentId: string): Promise<void> {
    const idea = this.ideas.get(ideaId);
    if (idea) {
      idea.votes++;
      
      this.emit('idea-voted', {
        conversationId: this.state.id,
        ideaId,
        voterAgentId,
        newVoteCount: idea.votes
      });
    }
  }

  /**
   * Select speaker for ideation phase
   */
  private selectForIdeation(): AgentParticipation | null {
    const participants = this.state.participants.filter(p => p.role !== 'observer');
    
    // Encourage diverse participation - select agent with fewest recent ideas
    const recentContributions = new Map<string, number>();
    const recentIdeas = Array.from(this.ideas.values())
      .filter(idea => Date.now() - idea.timestamp.getTime() < 60000); // Last minute
    
    for (const idea of recentIdeas) {
      recentContributions.set(idea.author, (recentContributions.get(idea.author) || 0) + 1);
    }

    // Select participant with lowest recent contribution count
    const leastActive = participants
      .map(p => ({
        participant: p,
        recentCount: recentContributions.get(p.agentName) || 0
      }))
      .sort((a, b) => {
        // Sort by contribution count first, then by priority
        const countDiff = a.recentCount - b.recentCount;
        if (countDiff !== 0) return countDiff;
        return b.participant.priority - a.participant.priority;
      })[0];

    return leastActive?.participant || participants[0];
  }

  /**
   * Select speaker for building phase
   */
  private selectForBuilding(): AgentParticipation | null {
    const participants = this.state.participants.filter(p => p.role !== 'observer');
    
    // Find ideas that need building upon
    const ideasNeedingBuilding = Array.from(this.ideas.values())
      .filter(idea => idea.buildUponCount === 0)
      .sort((a, b) => b.novelty - a.novelty); // Start with most novel

    if (ideasNeedingBuilding.length > 0) {
      // Select agent with relevant expertise or different perspective than original author
      const targetIdea = ideasNeedingBuilding[0];
      const availableBuilders = participants.filter(p => p.agentName !== targetIdea.author);
      
      return this.selectBestBuilder(availableBuilders, targetIdea);
    }

    // All ideas have been built upon, select randomly for additional building
    return participants[Math.floor(Math.random() * participants.length)];
  }

  /**
   * Select speaker for evaluation phase
   */
  private selectForEvaluation(): AgentParticipation | null {
    const participants = this.state.participants.filter(p => p.role !== 'observer');
    
    // Rotate through participants for fair evaluation
    const evaluationTurns = this.state.history.filter(msg => 
      this.currentPhase === 'evaluation' && msg.role !== 'system'
    ).length;
    
    return participants[evaluationTurns % participants.length];
  }

  /**
   * Select speaker for selection phase
   */
  private selectForSelection(): AgentParticipation | null {
    // Facilitator guides selection process
    return this.getParticipant(this.facilitator!) || this.state.participants[0];
  }

  /**
   * Select speaker for refinement phase
   */
  private selectForRefinement(): AgentParticipation | null {
    const participants = this.state.participants.filter(p => p.role !== 'observer');
    
    // Focus on top-rated ideas and their authors
    const topIdeas = this.getTopIdeas(3);
    const topAuthors = topIdeas.map(idea => idea.author);
    
    const topAuthorParticipants = participants.filter(p => 
      topAuthors.includes(p.agentName)
    );

    if (topAuthorParticipants.length > 0) {
      return topAuthorParticipants.sort((a, b) => b.priority - a.priority)[0];
    }

    return participants[0];
  }

  /**
   * Calculate novelty score for an idea
   */
  private calculateNovelty(content: string): number {
    // Simple novelty calculation based on uniqueness of words
    const words = content.toLowerCase().split(/\s+/);
    const existingWords = new Set<string>();
    
    for (const idea of this.ideas.values()) {
      const ideaWords = idea.content.toLowerCase().split(/\s+/);
      ideaWords.forEach(word => existingWords.add(word));
    }

    const uniqueWords = words.filter(word => !existingWords.has(word));
    return Math.min(uniqueWords.length / words.length, 1.0);
  }

  /**
   * Calculate feasibility score for an idea
   */
  private calculateFeasibility(content: string): number {
    // Simple feasibility heuristic based on complexity indicators
    const complexityIndicators = ['complex', 'difficult', 'advanced', 'sophisticated'];
    const simplicityIndicators = ['simple', 'easy', 'straightforward', 'basic'];
    
    const complexity = complexityIndicators.filter(indicator => 
      content.toLowerCase().includes(indicator)
    ).length;
    
    const simplicity = simplicityIndicators.filter(indicator => 
      content.toLowerCase().includes(indicator)
    ).length;

    // Moderate complexity is most feasible
    const complexityScore = Math.max(0, 1 - (complexity * 0.2));
    const simplicityBonus = simplicity * 0.1;
    
    return Math.min(complexityScore + simplicityBonus, 1.0);
  }

  /**
   * Calculate impact score for an idea
   */
  private calculateImpact(content: string): number {
    // Simple impact heuristic based on impact keywords
    const impactKeywords = [
      'revolutionary', 'breakthrough', 'significant', 'major', 'transformative',
      'game-changing', 'innovative', 'improve', 'enhance', 'solve'
    ];

    const impactScore = impactKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length;

    return Math.min(impactScore * 0.2, 1.0);
  }

  /**
   * Extract tags from idea content
   */
  private extractTags(content: string): string[] {
    // Simple tag extraction based on common words
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const uniqueWords = [...new Set(words)];
    return uniqueWords.slice(0, 5); // Top 5 tags
  }

  /**
   * Count ideas in a message
   */
  private countIdeasInMessage(content: string): number {
    const ideaIndicators = ['idea:', 'suggestion:', 'concept:', 'what if', 'we could'];
    return ideaIndicators.filter(indicator => 
      content.toLowerCase().includes(indicator)
    ).length || 1; // Default to 1 if no indicators
  }

  /**
   * Get recent ideas by agent
   */
  private getRecentIdeasByAgent(agentName: string, minutes: number): Idea[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return Array.from(this.ideas.values())
      .filter(idea => 
        idea.author === agentName && 
        idea.timestamp.getTime() > cutoff
      );
  }

  /**
   * Select best builder for an idea
   */
  private selectBestBuilder(participants: AgentParticipation[], idea: Idea): AgentParticipation {
    // Simple selection based on complementary expertise
    const categoryExperts = participants.filter(p => 
      p.specializations?.some(spec => 
        spec.toLowerCase().includes(idea.category.toLowerCase())
      )
    );

    if (categoryExperts.length > 0) {
      return categoryExperts.sort((a, b) => b.priority - a.priority)[0];
    }

    return participants.sort((a, b) => b.priority - a.priority)[0];
  }

  /**
   * Get top ideas by score
   */
  getTopIdeas(count: number = 5): Idea[] {
    return Array.from(this.ideas.values())
      .sort((a, b) => this.calculateTotalScore(b) - this.calculateTotalScore(a))
      .slice(0, count);
  }

  /**
   * Calculate total score for an idea
   */
  private calculateTotalScore(idea: Idea): number {
    return (
      idea.novelty * this.evaluationCriteria.novelty +
      idea.feasibility * this.evaluationCriteria.feasibility +
      idea.impact * this.evaluationCriteria.impact +
      (idea.votes * 0.1) + // Vote bonus
      (idea.buildUponCount * 0.05) // Build-upon bonus
    );
  }

  /**
   * Advance to next phase
   */
  private advancePhase(): void {
    const phases: BrainstormPhase[] = ['ideation', 'building', 'evaluation', 'selection', 'refinement'];
    const currentIndex = phases.indexOf(this.currentPhase);
    
    if (currentIndex < phases.length - 1) {
      this.currentPhase = phases[currentIndex + 1];
      this.phaseStartTime = new Date();
      
      this.emit('phase-advanced', {
        conversationId: this.state.id,
        newPhase: this.currentPhase,
        previousPhase: phases[currentIndex]
      });
    }
  }

  /**
   * Check if phase should advance due to timeout or completion
   */
  private shouldAdvancePhase(): boolean {
    const phaseTimeout = this.phaseTimeouts.get(this.currentPhase) || 300000;
    const timeInPhase = Date.now() - this.phaseStartTime.getTime();
    
    if (timeInPhase > phaseTimeout) {
      return true;
    }

    // Phase-specific completion checks
    switch (this.currentPhase) {
      case 'ideation':
        return this.ideas.size >= 10; // Minimum ideas generated
      
      case 'building':
        const ideasWithBuilding = Array.from(this.ideas.values())
          .filter(idea => idea.buildUponCount > 0);
        return ideasWithBuilding.length >= Math.min(this.ideas.size * 0.5, 5);
      
      case 'evaluation':
        const ideasWithVotes = Array.from(this.ideas.values())
          .filter(idea => idea.votes > 0);
        return ideasWithVotes.length >= Math.min(this.ideas.size * 0.7, 8);
      
      default:
        return false;
    }
  }

  /**
   * Get brainstorm statistics
   */
  getBrainstormStats(): BrainstormStats {
    const ideas = Array.from(this.ideas.values());
    const categories = new Set(ideas.map(idea => idea.category));
    
    const contributions = new Map<string, number>();
    for (const idea of ideas) {
      contributions.set(idea.author, (contributions.get(idea.author) || 0) + 1);
    }

    const topContributor = Array.from(contributions.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    const mostPopular = ideas.sort((a, b) => b.votes - a.votes)[0] || null;

    const participationRate: Record<string, number> = {};
    for (const participant of this.state.participants) {
      participationRate[participant.agentName] = contributions.get(participant.agentName) || 0;
    }

    return {
      totalIdeas: ideas.length,
      uniqueCategories: categories.size,
      averageNovelty: ideas.reduce((sum, idea) => sum + idea.novelty, 0) / ideas.length || 0,
      averageFeasibility: ideas.reduce((sum, idea) => sum + idea.feasibility, 0) / ideas.length || 0,
      averageImpact: ideas.reduce((sum, idea) => sum + idea.impact, 0) / ideas.length || 0,
      topContributor,
      mostPopularIdea: mostPopular,
      participationRate
    };
  }

  /**
   * Override to handle phase transitions
   */
  async addMessage(message: ConversationMessage): Promise<void> {
    // Auto-extract ideas from messages during ideation and building phases
    if ((this.currentPhase === 'ideation' || this.currentPhase === 'building') && 
        message.role !== 'system') {
      await this.extractIdeasFromMessage(message);
    }

    await super.addMessage(message);

    // Check for phase advancement
    if (this.shouldAdvancePhase()) {
      this.advancePhase();
    }
  }

  /**
   * Extract ideas from message content
   */
  private async extractIdeasFromMessage(message: ConversationMessage): Promise<void> {
    // Simple idea extraction - look for idea indicators
    const content = message.content;
    const ideaPatterns = [
      /idea:\s*(.+?)(?=\n|$)/gi,
      /suggestion:\s*(.+?)(?=\n|$)/gi,
      /what if\s+(.+?)(?=\n|$)/gi,
      /we could\s+(.+?)(?=\n|$)/gi
    ];

    for (const pattern of ideaPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        await this.addIdea(message.agent_id, match[1].trim(), 'general');
      }
    }

    // If no explicit ideas found but in ideation phase, treat whole message as idea
    if (this.currentPhase === 'ideation' && content.length > 20) {
      await this.addIdea(message.agent_id, content, 'general');
    }
  }

  /**
   * Get current session state
   */
  getCurrentSession(): {
    topic: string;
    goals: string[];
    phase: BrainstormPhase;
    ideasCount: number;
    topIdeas: Idea[];
    stats: BrainstormStats;
  } {
    return {
      topic: this.topic,
      goals: this.goals,
      phase: this.currentPhase,
      ideasCount: this.ideas.size,
      topIdeas: this.getTopIdeas(5),
      stats: this.getBrainstormStats()
    };
  }
}