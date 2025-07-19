/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { PersonalityTrait } from '../types.js';
import { PersonalityProfile, CommunicationStyle, BehaviorPattern, PersonalityPreferences } from './PersonalityGenerator.js';
import { 
  IPersonality, 
  ResponseTemplate, 
  DecisionWeights, 
  CompatibilityCheck,
  BehaviorContext,
  BehaviorResponse
} from '../interfaces.js';

/**
 * Integrated personality implementation
 */
export class IntegratedPersonality extends EventEmitter implements IPersonality {
  // Inherit all properties from PersonalityProfile
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly traits: PersonalityTrait[];
  public readonly communicationStyle: CommunicationStyle;
  public readonly behaviors: BehaviorPattern[];
  public readonly preferences: PersonalityPreferences;
  public readonly strengths: string[];
  public readonly weaknesses: string[];
  public readonly compatibilities: string[];
  public readonly conflictsWith: string[];

  private readonly baseProfile: PersonalityProfile;
  private responseTemplates: ResponseTemplate[] = [];
  private decisionWeights: DecisionWeights;
  private compatibilityCache = new Map<string, CompatibilityCheck>();
  private behaviorHistory: Array<{
    timestamp: Date;
    context: BehaviorContext;
    response: BehaviorResponse;
  }> = [];

  constructor(baseProfile: PersonalityProfile) {
    super();
    
    this.baseProfile = baseProfile;
    
    // Copy all properties from base profile
    this.id = baseProfile.id;
    this.name = baseProfile.name;
    this.description = baseProfile.description;
    this.traits = [...baseProfile.traits];
    this.communicationStyle = { ...baseProfile.communicationStyle };
    this.behaviors = [...baseProfile.behaviors];
    this.preferences = { ...baseProfile.preferences };
    this.strengths = [...baseProfile.strengths];
    this.weaknesses = [...baseProfile.weaknesses];
    this.compatibilities = [...baseProfile.compatibilities];
    this.conflictsWith = [...baseProfile.conflictsWith];

    // Initialize integrated components
    this.initializeResponseTemplates();
    this.initializeDecisionWeights();
  }

  /**
   * Get capabilities that are compatible with this personality
   */
  async getCompatibleCapabilities(): Promise<string[]> {
    const compatibleCapabilities: string[] = [];

    // Analyze traits to determine compatible capabilities
    for (const trait of this.traits) {
      if (trait.value > 0.7) {
        switch (trait.name) {
          case 'analytical':
            compatibleCapabilities.push('data-analysis', 'problem-solving', 'research', 'technical-analysis');
            break;
          case 'creative':
            compatibleCapabilities.push('creative-writing', 'design', 'innovation', 'brainstorming');
            break;
          case 'empathetic':
            compatibleCapabilities.push('customer-service', 'counseling', 'team-facilitation', 'communication');
            break;
          case 'detail-oriented':
            compatibleCapabilities.push('quality-assurance', 'documentation', 'compliance', 'auditing');
            break;
          case 'methodical':
            compatibleCapabilities.push('project-management', 'process-optimization', 'planning', 'organization');
            break;
          case 'adaptable':
            compatibleCapabilities.push('change-management', 'crisis-response', 'multi-tasking', 'flexibility');
            break;
          case 'collaborative':
            compatibleCapabilities.push('team-leadership', 'consensus-building', 'networking', 'partnership');
            break;
        }
      }
    }

    // Add capabilities based on communication style
    switch (this.communicationStyle.tone) {
      case 'authoritative':
        compatibleCapabilities.push('leadership', 'decision-making', 'conflict-resolution');
        break;
      case 'supportive':
        compatibleCapabilities.push('mentoring', 'coaching', 'emotional-support');
        break;
      case 'analytical':
        compatibleCapabilities.push('data-interpretation', 'logical-reasoning', 'systematic-analysis');
        break;
      case 'friendly':
        compatibleCapabilities.push('relationship-building', 'networking', 'customer-engagement');
        break;
    }

    // Add capabilities based on preferences
    switch (this.preferences.workingStyle) {
      case 'independent':
        compatibleCapabilities.push('self-management', 'autonomous-work', 'individual-contributor');
        break;
      case 'collaborative':
        compatibleCapabilities.push('team-collaboration', 'group-dynamics', 'shared-leadership');
        break;
      case 'directive':
        compatibleCapabilities.push('task-delegation', 'performance-management', 'strategic-direction');
        break;
    }

    // Remove duplicates and return
    return [...new Set(compatibleCapabilities)];
  }

  /**
   * Get response templates based on communication style
   */
  getResponseTemplates(): ResponseTemplate[] {
    return [...this.responseTemplates];
  }

  /**
   * Get decision weights for various scenarios
   */
  getDecisionWeights(): DecisionWeights {
    return { ...this.decisionWeights };
  }

  /**
   * Check if personality is compatible with given capabilities
   */
  async isCompatibleWith(capabilities: string[]): Promise<CompatibilityCheck> {
    const cacheKey = capabilities.sort().join(',');
    
    if (this.compatibilityCache.has(cacheKey)) {
      return this.compatibilityCache.get(cacheKey)!;
    }

    const compatibleCapabilities = await this.getCompatibleCapabilities();
    const conflicts: string[] = [];
    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Check for direct compatibility
    const directMatches = capabilities.filter(cap => compatibleCapabilities.includes(cap));
    const directMatchScore = directMatches.length / capabilities.length;

    // Check for trait-based conflicts
    for (const capability of capabilities) {
      // Technical capabilities with low analytical trait
      if (capability.includes('technical') && this.getTraitValue('analytical') < 0.5) {
        conflicts.push(`Low analytical trait may conflict with ${capability}`);
      }

      // Creative capabilities with low creativity trait
      if (capability.includes('creative') && this.getTraitValue('creative') < 0.5) {
        conflicts.push(`Low creativity trait may conflict with ${capability}`);
      }

      // Communication capabilities with low empathy
      if (capability.includes('communication') && this.getTraitValue('empathetic') < 0.4) {
        warnings.push(`Low empathy may reduce effectiveness in ${capability}`);
      }

      // Leadership capabilities with low assertiveness
      if (capability.includes('leadership') && this.getTraitValue('assertive') < 0.6) {
        warnings.push(`Low assertiveness may impact ${capability} effectiveness`);
      }
    }

    // Generate recommendations
    if (directMatchScore < 0.5) {
      recommendations.push('Consider personality adjustments to better align with required capabilities');
    }

    if (conflicts.length > 0) {
      recommendations.push('Address personality-capability conflicts through training or trait modification');
    }

    if (this.communicationStyle.formality === 'casual' && capabilities.some(c => c.includes('formal'))) {
      recommendations.push('Consider adjusting communication style for formal capabilities');
    }

    // Calculate overall compatibility score
    const conflictPenalty = conflicts.length * 0.2;
    const warningPenalty = warnings.length * 0.1;
    const styleBonus = this.calculateStyleBonus(capabilities);
    
    const score = Math.max(0, Math.min(1, directMatchScore + styleBonus - conflictPenalty - warningPenalty));
    const compatible = score > 0.6 && conflicts.length === 0;

    const result: CompatibilityCheck = {
      compatible,
      score,
      conflicts,
      recommendations,
      warnings
    };

    this.compatibilityCache.set(cacheKey, result);
    
    this.emit('compatibility-checked', {
      personalityId: this.id,
      capabilities,
      result
    });

    return result;
  }

  /**
   * Generate behavior responses for given context
   */
  async generateBehaviorResponse(context: BehaviorContext): Promise<BehaviorResponse> {
    // Find applicable behavior patterns
    const applicableBehaviors = this.behaviors.filter(behavior =>
      behavior.triggers.some(trigger => 
        context.situation.toLowerCase().includes(trigger.toLowerCase()) ||
        context.userInput.toLowerCase().includes(trigger.toLowerCase())
      )
    );

    // Sort by priority
    applicableBehaviors.sort((a, b) => a.priority - b.priority);

    // Generate response based on personality traits and communication style
    const response = await this.generatePersonalizedResponse(context, applicableBehaviors);
    
    // Calculate confidence based on trait alignment
    const confidence = this.calculateResponseConfidence(context, applicableBehaviors);
    
    // Generate reasoning
    const reasoning = this.generateResponseReasoning(context, applicableBehaviors);
    
    // Suggest actions based on preferences
    const suggestedActions = this.generateSuggestedActions(context);
    
    // Determine emotional state
    const emotionalState = this.determineEmotionalState(context);

    const behaviorResponse: BehaviorResponse = {
      response,
      confidence,
      reasoning,
      suggestedActions,
      emotionalState
    };

    // Store in history
    this.behaviorHistory.push({
      timestamp: new Date(),
      context,
      response: behaviorResponse
    });

    this.emit('behavior-generated', {
      personalityId: this.id,
      context,
      response: behaviorResponse
    });

    return behaviorResponse;
  }

  /**
   * Update personality traits dynamically
   */
  async updateTrait(traitName: string, value: number): Promise<boolean> {
    const trait = this.traits.find(t => t.name === traitName);
    if (!trait) return false;

    const oldValue = trait.value;
    trait.value = Math.max(0, Math.min(1, value));

    // Update dependent components
    this.updateDecisionWeights();
    this.updateResponseTemplates();
    
    // Clear compatibility cache
    this.compatibilityCache.clear();

    this.emit('trait-updated', {
      personalityId: this.id,
      traitName,
      oldValue,
      newValue: trait.value
    });

    return true;
  }

  /**
   * Get personality strength score for a domain
   */
  getStrengthScore(domain: string): number {
    const domainTraitMap: Record<string, string[]> = {
      'technical': ['analytical', 'methodical', 'detail-oriented', 'logical'],
      'creative': ['creative', 'imaginative', 'open-minded', 'innovative'],
      'business': ['analytical', 'decisive', 'strategic', 'results-oriented'],
      'social': ['empathetic', 'collaborative', 'communicative', 'supportive'],
      'leadership': ['assertive', 'decisive', 'inspirational', 'strategic'],
      'research': ['analytical', 'methodical', 'curious', 'thorough'],
      'customer-service': ['empathetic', 'patient', 'helpful', 'communicative']
    };

    const relevantTraits = domainTraitMap[domain] || [];
    if (relevantTraits.length === 0) return 0.5; // Default neutral score

    const traitScores = relevantTraits.map(traitName => {
      const trait = this.traits.find(t => t.name === traitName);
      return trait ? trait.value : 0.5; // Default value if trait not found
    });

    return traitScores.reduce((sum, score) => sum + score, 0) / traitScores.length;
  }

  /**
   * Private helper methods
   */
  private initializeResponseTemplates(): void {
    this.responseTemplates = [];

    // Generate templates based on communication style
    const baseTemplates = this.getBaseTemplates();
    
    // Map communication style tone to response template tone
    const toneMap: Record<string, 'friendly' | 'neutral' | 'authoritative'> = {
      'friendly': 'friendly',
      'supportive': 'friendly',
      'analytical': 'neutral',
      'authoritative': 'authoritative',
      'neutral': 'neutral'
    };
    
    const templateTone = toneMap[this.communicationStyle.tone] || 'neutral';
    
    for (const template of baseTemplates) {
      this.responseTemplates.push({
        ...template,
        style: {
          formality: this.communicationStyle.formality,
          tone: templateTone,
          length: this.communicationStyle.verbosity === 'concise' ? 'short' : 
                 this.communicationStyle.verbosity === 'detailed' ? 'long' : 'medium'
        }
      });
    }
  }

  private initializeDecisionWeights(): void {
    this.decisionWeights = {
      speed: this.getTraitValue('efficient') || this.getTraitValue('quick') || 0.5,
      accuracy: this.getTraitValue('detail-oriented') || this.getTraitValue('methodical') || 0.5,
      creativity: this.getTraitValue('creative') || this.getTraitValue('innovative') || 0.5,
      collaboration: this.getTraitValue('collaborative') || this.getTraitValue('team-oriented') || 0.5,
      risktaking: this.getTraitValue('risk-taking') || this.getTraitValue('adventurous') || 0.5,
      detailOrientation: this.getTraitValue('detail-oriented') || this.getTraitValue('thorough') || 0.5,
      userFocus: this.getTraitValue('user-focused') || this.getTraitValue('customer-oriented') || 0.7
    };
  }

  private getTraitValue(traitName: string): number {
    const trait = this.traits.find(t => t.name === traitName);
    return trait ? trait.value : 0;
  }

  private calculateStyleBonus(capabilities: string[]): number {
    let bonus = 0;

    // Communication style bonuses
    if (this.communicationStyle.tone === 'analytical' && capabilities.some(c => c.includes('analysis'))) {
      bonus += 0.1;
    }

    if (this.communicationStyle.tone === 'supportive' && capabilities.some(c => c.includes('support'))) {
      bonus += 0.1;
    }

    // Preference bonuses
    if (this.preferences.workingStyle === 'collaborative' && capabilities.some(c => c.includes('team'))) {
      bonus += 0.1;
    }

    if (this.preferences.decisionMaking === 'analytical' && capabilities.some(c => c.includes('analysis'))) {
      bonus += 0.1;
    }

    return bonus;
  }

  private async generatePersonalizedResponse(context: BehaviorContext, behaviors: BehaviorPattern[]): Promise<string> {
    let response = "I understand your request. ";

    // Add personality-specific response elements
    if (this.getTraitValue('empathetic') > 0.7) {
      response += "I can sense this is important to you. ";
    }

    if (this.getTraitValue('analytical') > 0.7) {
      response += "Let me analyze this systematically. ";
    }

    if (this.getTraitValue('creative') > 0.7) {
      response += "I see several creative possibilities here. ";
    }

    // Add behavior-specific responses
    if (behaviors.length > 0) {
      const primaryBehavior = behaviors[0];
      if (primaryBehavior.responses.length > 0) {
        response += primaryBehavior.responses[0] + " ";
      }
    }

    // Add communication style adjustments
    switch (this.communicationStyle.formality) {
      case 'formal':
        response = response.replace(/I'll/g, "I will").replace(/Let's/g, "Let us");
        break;
      case 'casual':
        response += "Feel free to let me know if you need anything else! ";
        break;
    }

    return response.trim();
  }

  private calculateResponseConfidence(context: BehaviorContext, behaviors: BehaviorPattern[]): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if we have matching behaviors
    if (behaviors.length > 0) {
      confidence += 0.2;
    }

    // Increase confidence based on relevant traits
    const situationKeywords = context.situation.toLowerCase().split(' ');
    for (const keyword of situationKeywords) {
      for (const trait of this.traits) {
        if (trait.name.toLowerCase().includes(keyword) && trait.value > 0.7) {
          confidence += 0.1;
        }
      }
    }

    // Increase confidence if we have compatible capabilities
    if (context.currentCapabilities.length > 0) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  private generateResponseReasoning(context: BehaviorContext, behaviors: BehaviorPattern[]): string {
    const reasons: string[] = [];

    if (behaviors.length > 0) {
      reasons.push(`Applied ${behaviors[0].name} behavior pattern`);
    }

    const dominantTraits = this.traits.filter(t => t.value > 0.7).map(t => t.name);
    if (dominantTraits.length > 0) {
      reasons.push(`Influenced by ${dominantTraits.join(', ')} personality traits`);
    }

    reasons.push(`Communication styled as ${this.communicationStyle.tone} and ${this.communicationStyle.formality}`);

    return reasons.join('. ');
  }

  private generateSuggestedActions(context: BehaviorContext): string[] {
    const actions: string[] = [];

    // Actions based on preferences
    switch (this.preferences.workingStyle) {
      case 'collaborative':
        actions.push('Involve others in the solution');
        actions.push('Seek team input');
        break;
      case 'independent':
        actions.push('Develop autonomous solution');
        actions.push('Self-evaluate progress');
        break;
    }

    // Actions based on dominant traits
    if (this.getTraitValue('methodical') > 0.7) {
      actions.push('Create step-by-step plan');
      actions.push('Document process');
    }

    if (this.getTraitValue('creative') > 0.7) {
      actions.push('Explore alternative approaches');
      actions.push('Brainstorm innovative solutions');
    }

    return actions;
  }

  private determineEmotionalState(context: BehaviorContext): string {
    // Determine emotional state based on traits and context
    if (context.situation.includes('problem') || context.situation.includes('issue')) {
      if (this.getTraitValue('calm') > 0.7) {
        return 'focused';
      } else if (this.getTraitValue('empathetic') > 0.7) {
        return 'concerned';
      } else {
        return 'analytical';
      }
    }

    if (context.situation.includes('success') || context.situation.includes('achievement')) {
      if (this.getTraitValue('enthusiastic') > 0.6) {
        return 'excited';
      } else {
        return 'satisfied';
      }
    }

    // Default emotional state based on dominant traits
    const dominantTrait = this.traits.reduce((max, trait) => trait.value > max.value ? trait : max);
    
    switch (dominantTrait.name) {
      case 'empathetic':
        return 'caring';
      case 'analytical':
        return 'thoughtful';
      case 'creative':
        return 'inspired';
      case 'methodical':
        return 'organized';
      default:
        return 'engaged';
    }
  }

  private updateDecisionWeights(): void {
    this.initializeDecisionWeights();
  }

  private updateResponseTemplates(): void {
    this.initializeResponseTemplates();
  }

  private getBaseTemplates(): Omit<ResponseTemplate, 'style'>[] {
    return [
      {
        id: 'greeting',
        name: 'Greeting Template',
        pattern: 'Hello! I\'m here to help you with {topic}.',
        triggers: ['hello', 'hi', 'greeting'],
        variables: { topic: 'your request' }
      },
      {
        id: 'problem-solving',
        name: 'Problem Solving Template',
        pattern: 'I understand the challenge with {problem}. Let me help you {solution_approach}.',
        triggers: ['problem', 'issue', 'challenge'],
        variables: { problem: 'your situation', solution_approach: 'find a solution' }
      },
      {
        id: 'information-request',
        name: 'Information Request Template',
        pattern: 'I\'d be happy to provide information about {topic}. {additional_context}',
        triggers: ['what', 'how', 'information'],
        variables: { topic: 'that topic', additional_context: '' }
      },
      {
        id: 'confirmation',
        name: 'Confirmation Template',
        pattern: 'I\'ve completed {task} as requested. {next_steps}',
        triggers: ['done', 'completed', 'finished'],
        variables: { task: 'the task', next_steps: 'Is there anything else you need?' }
      }
    ];
  }
}

/**
 * Personality integration events
 */
export interface PersonalityIntegrationEvents {
  'compatibility-checked': {
    personalityId: string;
    capabilities: string[];
    result: CompatibilityCheck;
  };
  'behavior-generated': {
    personalityId: string;
    context: BehaviorContext;
    response: BehaviorResponse;
  };
  'trait-updated': {
    personalityId: string;
    traitName: string;
    oldValue: number;
    newValue: number;
  };
}

/**
 * Type the EventEmitter properly
 */
export interface IntegratedPersonality {
  on<K extends keyof PersonalityIntegrationEvents>(event: K, listener: (data: PersonalityIntegrationEvents[K]) => void): this;
  emit<K extends keyof PersonalityIntegrationEvents>(event: K, data: PersonalityIntegrationEvents[K]): boolean;
}