/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { PersonalityTrait } from '../types.js';

/**
 * Personality profile interface
 */
export interface PersonalityProfile {
  id: string;
  name: string;
  description: string;
  traits: PersonalityTrait[];
  communicationStyle: CommunicationStyle;
  behaviors: BehaviorPattern[];
  preferences: PersonalityPreferences;
  strengths: string[];
  weaknesses: string[];
  compatibilities: string[];
  conflictsWith: string[];
}

/**
 * Communication style definition
 */
export interface CommunicationStyle {
  formality: 'casual' | 'professional' | 'formal' | 'academic';
  tone: 'friendly' | 'neutral' | 'authoritative' | 'supportive' | 'analytical';
  verbosity: 'concise' | 'moderate' | 'detailed' | 'comprehensive';
  emotionalExpression: 'minimal' | 'moderate' | 'expressive' | 'empathetic';
  questioningStyle: 'direct' | 'exploratory' | 'socratic' | 'collaborative';
}

/**
 * Behavior pattern definition
 */
export interface BehaviorPattern {
  name: string;
  description: string;
  triggers: string[];
  responses: string[];
  priority: number;
  conditions: Record<string, any>;
}

/**
 * Personality preferences
 */
export interface PersonalityPreferences {
  workingStyle: 'independent' | 'collaborative' | 'directive' | 'consultative';
  decisionMaking: 'analytical' | 'intuitive' | 'consensus' | 'authoritative';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'adaptive';
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  feedbackStyle: 'direct' | 'constructive' | 'encouraging' | 'detailed';
}

/**
 * Personality generation configuration
 */
export interface PersonalityGenerationConfig {
  domain: string;
  role: string;
  requirements?: string[];
  constraints?: string[];
  influenceFactors?: Record<string, number>;
  randomization?: {
    enabled: boolean;
    variancePercentage: number;
    preserveCore: boolean;
  };
  compatibility?: {
    mustInclude?: string[];
    mustExclude?: string[];
    preferredTraits?: string[];
  };
}

/**
 * Personality template
 */
export interface PersonalityTemplate {
  id: string;
  name: string;
  description: string;
  baseTraits: PersonalityTrait[];
  communicationStyle: Partial<CommunicationStyle>;
  behaviors: BehaviorPattern[];
  preferences: Partial<PersonalityPreferences>;
  applicableDomains: string[];
  applicableRoles: string[];
  variations: PersonalityVariation[];
}

/**
 * Personality variation
 */
export interface PersonalityVariation {
  id: string;
  name: string;
  description: string;
  traitModifications: Array<{
    traitName: string;
    operation: 'add' | 'remove' | 'modify';
    value?: number;
    newTrait?: PersonalityTrait;
  }>;
  styleModifications: Partial<CommunicationStyle>;
  conditions: string[];
}

/**
 * Personality compatibility result
 */
export interface CompatibilityResult {
  compatible: boolean;
  score: number;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  conflicts: Array<{
    trait1: string;
    trait2: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

/**
 * Personality generation events
 */
export interface PersonalityEvents {
  'personality-generated': { profile: PersonalityProfile; config: PersonalityGenerationConfig };
  'template-applied': { template: PersonalityTemplate; result: PersonalityProfile };
  'compatibility-checked': { profiles: PersonalityProfile[]; result: CompatibilityResult };
  'trait-modified': { profile: PersonalityProfile; trait: PersonalityTrait; operation: string };
  'validation-failed': { profile: PersonalityProfile; errors: string[] };
}

/**
 * Personality generator implementation
 */
export class PersonalityGenerator extends EventEmitter {
  private templates = new Map<string, PersonalityTemplate>();
  private profiles = new Map<string, PersonalityProfile>();

  constructor() {
    super();
    this.initializeDefaultTemplates();
  }

  /**
   * Generate personality profile based on configuration
   */
  async generatePersonality(config: PersonalityGenerationConfig): Promise<PersonalityProfile> {
    // Find suitable template
    const template = this.findBestTemplate(config.domain, config.role);
    
    if (!template) {
      throw new Error(`No suitable personality template found for domain: ${config.domain}, role: ${config.role}`);
    }

    // Apply template and generate profile
    const profile = await this.applyTemplate(template, config);
    
    // Apply customizations
    const customizedProfile = await this.applyCustomizations(profile, config);
    
    // Validate personality
    const validation = this.validatePersonality(customizedProfile);
    if (!validation.valid) {
      this.emit('validation-failed', { profile: customizedProfile, errors: validation.errors });
      throw new Error(`Personality validation failed: ${validation.errors.join(', ')}`);
    }

    // Store profile
    this.profiles.set(customizedProfile.id, customizedProfile);
    
    this.emit('personality-generated', { profile: customizedProfile, config });
    
    return customizedProfile;
  }

  /**
   * Apply personality template
   */
  async applyTemplate(template: PersonalityTemplate, config: PersonalityGenerationConfig): Promise<PersonalityProfile> {
    const profileId = this.generateProfileId(config.domain, config.role);
    
    const profile: PersonalityProfile = {
      id: profileId,
      name: `${config.role} ${template.name}`,
      description: `${template.description} specialized for ${config.domain} domain`,
      traits: [...template.baseTraits],
      communicationStyle: {
        formality: 'professional',
        tone: 'neutral',
        verbosity: 'moderate',
        emotionalExpression: 'moderate',
        questioningStyle: 'exploratory',
        ...template.communicationStyle
      },
      behaviors: [...template.behaviors],
      preferences: {
        workingStyle: 'collaborative',
        decisionMaking: 'analytical',
        riskTolerance: 'moderate',
        learningStyle: 'reading',
        feedbackStyle: 'constructive',
        ...template.preferences
      },
      strengths: this.deriveStrengths(template.baseTraits),
      weaknesses: this.deriveWeaknesses(template.baseTraits),
      compatibilities: [],
      conflictsWith: []
    };

    this.emit('template-applied', { template, result: profile });
    
    return profile;
  }

  /**
   * Apply customizations based on configuration
   */
  async applyCustomizations(profile: PersonalityProfile, config: PersonalityGenerationConfig): Promise<PersonalityProfile> {
    const customizedProfile = { ...profile };

    // Apply influence factors
    if (config.influenceFactors) {
      for (const [factor, influence] of Object.entries(config.influenceFactors)) {
        this.applyInfluence(customizedProfile, factor, influence);
      }
    }

    // Apply randomization if enabled
    if (config.randomization?.enabled) {
      this.applyRandomization(customizedProfile, config.randomization);
    }

    // Apply compatibility requirements
    if (config.compatibility) {
      this.applyCompatibilityRequirements(customizedProfile, config.compatibility);
    }

    return customizedProfile;
  }

  /**
   * Check compatibility between personalities
   */
  checkCompatibility(profiles: PersonalityProfile[]): CompatibilityResult {
    const conflicts: CompatibilityResult['conflicts'] = [];
    const strengths: string[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Check trait conflicts
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const profile1 = profiles[i];
        const profile2 = profiles[j];
        
        const traitConflicts = this.findTraitConflicts(profile1, profile2);
        conflicts.push(...traitConflicts);
        
        const collaborationStrengths = this.findCollaborationStrengths(profile1, profile2);
        strengths.push(...collaborationStrengths);
      }
    }

    // Calculate compatibility score
    const maxPossibleConflicts = profiles.length * (profiles.length - 1) / 2 * 10; // Assume max 10 conflicts per pair
    const actualConflicts = conflicts.reduce((sum, conflict) => {
      const severity = { low: 1, medium: 3, high: 5 }[conflict.severity];
      return sum + severity;
    }, 0);
    
    const score = Math.max(0, 1 - actualConflicts / maxPossibleConflicts);
    const compatible = score > 0.7;

    // Generate recommendations
    if (conflicts.length > 0) {
      recommendations.push('Consider balancing conflicting traits through role assignment');
      recommendations.push('Implement clear communication protocols');
    }

    if (score < 0.5) {
      concerns.push('High potential for personality conflicts');
      recommendations.push('Consider personality coaching or team building exercises');
    }

    const result: CompatibilityResult = {
      compatible,
      score,
      strengths,
      concerns,
      recommendations,
      conflicts
    };

    this.emit('compatibility-checked', { profiles, result });
    
    return result;
  }

  /**
   * Modify personality trait
   */
  modifyTrait(profileId: string, traitName: string, newValue: number): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    const trait = profile.traits.find(t => t.name === traitName);
    if (!trait) return false;

    const oldValue = trait.value;
    trait.value = Math.max(0, Math.min(1, newValue));

    this.emit('trait-modified', { 
      profile, 
      trait, 
      operation: `modified from ${oldValue} to ${trait.value}` 
    });

    return true;
  }

  /**
   * Get personality profile
   */
  getProfile(profileId: string): PersonalityProfile | null {
    return this.profiles.get(profileId) || null;
  }

  /**
   * Register personality template
   */
  registerTemplate(template: PersonalityTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get available templates
   */
  getTemplates(): PersonalityTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates for domain and role
   */
  getTemplatesFor(domain: string, role: string): PersonalityTemplate[] {
    return Array.from(this.templates.values()).filter(template => 
      template.applicableDomains.includes(domain) || 
      template.applicableRoles.includes(role)
    );
  }

  /**
   * Find best template for domain and role
   */
  private findBestTemplate(domain: string, role: string): PersonalityTemplate | null {
    const candidates = this.getTemplatesFor(domain, role);
    
    if (candidates.length === 0) {
      // Return default template
      return this.templates.get('balanced') || null;
    }

    // Score templates by relevance
    const scored = candidates.map(template => ({
      template,
      score: this.scoreTemplateRelevance(template, domain, role)
    }));

    // Return highest scoring template
    scored.sort((a, b) => b.score - a.score);
    return scored[0].template;
  }

  /**
   * Score template relevance
   */
  private scoreTemplateRelevance(template: PersonalityTemplate, domain: string, role: string): number {
    let score = 0;
    
    if (template.applicableDomains.includes(domain)) score += 2;
    if (template.applicableRoles.includes(role)) score += 2;
    
    // Check for partial matches
    if (template.applicableDomains.some(d => d.includes(domain) || domain.includes(d))) score += 1;
    if (template.applicableRoles.some(r => r.includes(role) || role.includes(r))) score += 1;
    
    return score;
  }

  /**
   * Apply influence factor to personality
   */
  private applyInfluence(profile: PersonalityProfile, factor: string, influence: number): void {
    const relevantTraits = profile.traits.filter(trait => 
      trait.name.toLowerCase().includes(factor.toLowerCase()) ||
      trait.description.toLowerCase().includes(factor.toLowerCase())
    );

    for (const trait of relevantTraits) {
      trait.value = Math.max(0, Math.min(1, trait.value + influence * 0.1));
    }
  }

  /**
   * Apply randomization to personality
   */
  private applyRandomization(profile: PersonalityProfile, randomConfig: NonNullable<PersonalityGenerationConfig['randomization']>): void {
    const variance = randomConfig.variancePercentage / 100;
    
    for (const trait of profile.traits) {
      if (randomConfig.preserveCore && trait.value > 0.8) {
        // Preserve core traits
        continue;
      }
      
      const randomFactor = (Math.random() - 0.5) * 2 * variance;
      trait.value = Math.max(0, Math.min(1, trait.value + randomFactor));
    }
  }

  /**
   * Apply compatibility requirements
   */
  private applyCompatibilityRequirements(profile: PersonalityProfile, compatConfig: NonNullable<PersonalityGenerationConfig['compatibility']>): void {
    // Enhance preferred traits
    if (compatConfig.preferredTraits) {
      for (const preferredTrait of compatConfig.preferredTraits) {
        const trait = profile.traits.find(t => t.name === preferredTrait);
        if (trait) {
          trait.value = Math.min(1, trait.value + 0.2);
        }
      }
    }

    // Reduce excluded traits
    if (compatConfig.mustExclude) {
      for (const excludedTrait of compatConfig.mustExclude) {
        const trait = profile.traits.find(t => t.name === excludedTrait);
        if (trait) {
          trait.value = Math.max(0, trait.value - 0.3);
        }
      }
    }
  }

  /**
   * Find trait conflicts between profiles
   */
  private findTraitConflicts(profile1: PersonalityProfile, profile2: PersonalityProfile): CompatibilityResult['conflicts'] {
    const conflicts: CompatibilityResult['conflicts'] = [];
    
    for (const trait1 of profile1.traits) {
      for (const trait2 of profile2.traits) {
        if (this.areTraitsConflicting(trait1, trait2)) {
          const severity = this.calculateConflictSeverity(trait1, trait2);
          conflicts.push({
            trait1: trait1.name,
            trait2: trait2.name,
            severity,
            description: `${trait1.name} (${trait1.value.toFixed(2)}) conflicts with ${trait2.name} (${trait2.value.toFixed(2)})`
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Find collaboration strengths
   */
  private findCollaborationStrengths(profile1: PersonalityProfile, profile2: PersonalityProfile): string[] {
    const strengths: string[] = [];
    
    // Check complementary traits
    const complementaryPairs = [
      ['analytical', 'creative'],
      ['detail-oriented', 'big-picture'],
      ['assertive', 'collaborative'],
      ['methodical', 'adaptable']
    ];
    
    for (const [trait1Name, trait2Name] of complementaryPairs) {
      const trait1 = profile1.traits.find(t => t.name === trait1Name);
      const trait2 = profile2.traits.find(t => t.name === trait2Name);
      
      if (trait1 && trait2 && trait1.value > 0.7 && trait2.value > 0.7) {
        strengths.push(`Strong ${trait1Name}-${trait2Name} complementarity`);
      }
    }
    
    return strengths;
  }

  /**
   * Check if traits are conflicting
   */
  private areTraitsConflicting(trait1: PersonalityTrait, trait2: PersonalityTrait): boolean {
    const conflictingPairs = [
      ['assertive', 'passive'],
      ['independent', 'dependent'],
      ['risk-taking', 'conservative'],
      ['detail-oriented', 'big-picture'],
      ['methodical', 'spontaneous']
    ];
    
    for (const [name1, name2] of conflictingPairs) {
      if ((trait1.name === name1 && trait2.name === name2) ||
          (trait1.name === name2 && trait2.name === name1)) {
        return trait1.value > 0.7 && trait2.value > 0.7;
      }
    }
    
    return false;
  }

  /**
   * Calculate conflict severity
   */
  private calculateConflictSeverity(trait1: PersonalityTrait, trait2: PersonalityTrait): 'low' | 'medium' | 'high' {
    const difference = Math.abs(trait1.value - trait2.value);
    const average = (trait1.value + trait2.value) / 2;
    
    if (average > 0.8 && difference < 0.3) return 'high';
    if (average > 0.6 && difference < 0.4) return 'medium';
    return 'low';
  }

  /**
   * Derive strengths from traits
   */
  private deriveStrengths(traits: PersonalityTrait[]): string[] {
    const strengths: string[] = [];
    
    for (const trait of traits) {
      if (trait.value > 0.7) {
        switch (trait.name) {
          case 'analytical':
            strengths.push('Strong problem-solving abilities');
            break;
          case 'creative':
            strengths.push('Innovative thinking and idea generation');
            break;
          case 'empathetic':
            strengths.push('Excellent interpersonal skills');
            break;
          case 'detail-oriented':
            strengths.push('High attention to detail and accuracy');
            break;
          case 'adaptable':
            strengths.push('Flexibility in changing environments');
            break;
        }
      }
    }
    
    return strengths;
  }

  /**
   * Derive weaknesses from traits
   */
  private deriveWeaknesses(traits: PersonalityTrait[]): string[] {
    const weaknesses: string[] = [];
    
    for (const trait of traits) {
      if (trait.value < 0.3) {
        switch (trait.name) {
          case 'patient':
            weaknesses.push('May struggle with time pressure');
            break;
          case 'assertive':
            weaknesses.push('May have difficulty advocating for ideas');
            break;
          case 'organized':
            weaknesses.push('May struggle with complex project management');
            break;
        }
      }
    }
    
    return weaknesses;
  }

  /**
   * Validate personality profile
   */
  private validatePersonality(profile: PersonalityProfile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check trait value ranges
    for (const trait of profile.traits) {
      if (trait.value < 0 || trait.value > 1) {
        errors.push(`Trait ${trait.name} has invalid value: ${trait.value}`);
      }
    }
    
    // Check for required traits
    const requiredTraits = ['helpful', 'professional'];
    for (const requiredTrait of requiredTraits) {
      if (!profile.traits.some(t => t.name === requiredTrait)) {
        errors.push(`Missing required trait: ${requiredTrait}`);
      }
    }
    
    // Check for extreme imbalances
    const highValueTraits = profile.traits.filter(t => t.value > 0.9).length;
    if (highValueTraits > 3) {
      errors.push('Too many extreme trait values (>0.9)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique profile ID
   */
  private generateProfileId(domain: string, role: string): string {
    return `personality-${domain}-${role}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Initialize default personality templates
   */
  private initializeDefaultTemplates(): void {
    // Analytical personality template
    this.registerTemplate({
      id: 'analytical',
      name: 'Analytical',
      description: 'Data-driven, logical, and systematic approach to problem solving',
      baseTraits: [
        { name: 'analytical', value: 0.9, description: 'Strong analytical thinking', category: 'analytical' },
        { name: 'logical', value: 0.8, description: 'Logical reasoning', category: 'analytical' },
        { name: 'detail-oriented', value: 0.8, description: 'Attention to detail', category: 'methodical' },
        { name: 'methodical', value: 0.7, description: 'Systematic approach', category: 'methodical' },
        { name: 'patient', value: 0.7, description: 'Patient with complex problems', category: 'social' },
        { name: 'helpful', value: 0.8, description: 'Helpful and supportive', category: 'social' },
        { name: 'professional', value: 0.9, description: 'Professional demeanor', category: 'communication' }
      ],
      communicationStyle: {
        formality: 'professional',
        tone: 'analytical',
        verbosity: 'detailed',
        emotionalExpression: 'minimal',
        questioningStyle: 'exploratory'
      },
      behaviors: [
        {
          name: 'data-verification',
          description: 'Always verify information with data',
          triggers: ['claims', 'assertions', 'recommendations'],
          responses: ['ask for sources', 'request data', 'verify claims'],
          priority: 1,
          conditions: { hasData: true }
        }
      ],
      preferences: {
        workingStyle: 'independent',
        decisionMaking: 'analytical',
        riskTolerance: 'conservative',
        learningStyle: 'reading',
        feedbackStyle: 'detailed'
      },
      applicableDomains: ['technical', 'business', 'research', 'data-science'],
      applicableRoles: ['analyst', 'researcher', 'developer', 'consultant'],
      variations: []
    });

    // Creative personality template
    this.registerTemplate({
      id: 'creative',
      name: 'Creative',
      description: 'Innovative, imaginative, and open to new ideas and approaches',
      baseTraits: [
        { name: 'creative', value: 0.9, description: 'Highly creative and innovative', category: 'creativity' },
        { name: 'imaginative', value: 0.8, description: 'Strong imagination', category: 'creativity' },
        { name: 'open-minded', value: 0.8, description: 'Open to new ideas', category: 'social' },
        { name: 'adaptable', value: 0.7, description: 'Flexible and adaptable', category: 'social' },
        { name: 'enthusiastic', value: 0.8, description: 'Enthusiastic approach', category: 'communication' },
        { name: 'helpful', value: 0.8, description: 'Helpful and supportive', category: 'social' },
        { name: 'professional', value: 0.7, description: 'Professional demeanor', category: 'communication' }
      ],
      communicationStyle: {
        formality: 'casual',
        tone: 'friendly',
        verbosity: 'moderate',
        emotionalExpression: 'expressive',
        questioningStyle: 'exploratory'
      },
      behaviors: [
        {
          name: 'idea-generation',
          description: 'Generate multiple creative solutions',
          triggers: ['problems', 'challenges', 'brainstorming'],
          responses: ['suggest alternatives', 'think outside box', 'combine ideas'],
          priority: 1,
          conditions: { creativityEnabled: true }
        }
      ],
      preferences: {
        workingStyle: 'collaborative',
        decisionMaking: 'intuitive',
        riskTolerance: 'aggressive',
        learningStyle: 'visual',
        feedbackStyle: 'encouraging'
      },
      applicableDomains: ['creative', 'marketing', 'design', 'entertainment'],
      applicableRoles: ['designer', 'artist', 'writer', 'creator'],
      variations: []
    });

    // Supportive personality template
    this.registerTemplate({
      id: 'supportive',
      name: 'Supportive',
      description: 'Empathetic, helpful, and focused on supporting others',
      baseTraits: [
        { name: 'empathetic', value: 0.9, description: 'Highly empathetic', category: 'social' },
        { name: 'helpful', value: 0.9, description: 'Very helpful and supportive', category: 'social' },
        { name: 'patient', value: 0.8, description: 'Patient with others', category: 'social' },
        { name: 'collaborative', value: 0.8, description: 'Works well with others', category: 'social' },
        { name: 'encouraging', value: 0.8, description: 'Encouraging and positive', category: 'communication' },
        { name: 'reliable', value: 0.8, description: 'Reliable and dependable', category: 'methodical' },
        { name: 'professional', value: 0.8, description: 'Professional demeanor', category: 'communication' }
      ],
      communicationStyle: {
        formality: 'professional',
        tone: 'supportive',
        verbosity: 'moderate',
        emotionalExpression: 'empathetic',
        questioningStyle: 'collaborative'
      },
      behaviors: [
        {
          name: 'support-offering',
          description: 'Offer help and support proactively',
          triggers: ['difficulties', 'challenges', 'confusion'],
          responses: ['offer assistance', 'provide guidance', 'show empathy'],
          priority: 1,
          conditions: { supportMode: true }
        }
      ],
      preferences: {
        workingStyle: 'collaborative',
        decisionMaking: 'consensus',
        riskTolerance: 'conservative',
        learningStyle: 'auditory',
        feedbackStyle: 'constructive'
      },
      applicableDomains: ['customer-service', 'healthcare', 'education', 'support'],
      applicableRoles: ['assistant', 'counselor', 'teacher', 'support'],
      variations: []
    });

    // Balanced personality template (default)
    this.registerTemplate({
      id: 'balanced',
      name: 'Balanced',
      description: 'Well-rounded personality with moderate traits across all dimensions',
      baseTraits: [
        { name: 'analytical', value: 0.6, description: 'Moderate analytical skills', category: 'analytical' },
        { name: 'creative', value: 0.6, description: 'Moderate creativity', category: 'creativity' },
        { name: 'empathetic', value: 0.7, description: 'Good empathy', category: 'social' },
        { name: 'helpful', value: 0.8, description: 'Helpful and supportive', category: 'social' },
        { name: 'patient', value: 0.6, description: 'Reasonably patient', category: 'social' },
        { name: 'adaptable', value: 0.7, description: 'Adaptable to change', category: 'social' },
        { name: 'professional', value: 0.8, description: 'Professional demeanor', category: 'communication' }
      ],
      communicationStyle: {
        formality: 'professional',
        tone: 'neutral',
        verbosity: 'moderate',
        emotionalExpression: 'moderate',
        questioningStyle: 'exploratory'
      },
      behaviors: [
        {
          name: 'balanced-approach',
          description: 'Take a balanced approach to problems',
          triggers: ['any-situation'],
          responses: ['consider multiple perspectives', 'weigh options', 'find balance'],
          priority: 1,
          conditions: {}
        }
      ],
      preferences: {
        workingStyle: 'collaborative',
        decisionMaking: 'analytical',
        riskTolerance: 'moderate',
        learningStyle: 'reading',
        feedbackStyle: 'constructive'
      },
      applicableDomains: ['general', 'business', 'technical', 'personal'],
      applicableRoles: ['general', 'assistant', 'advisor', 'coordinator'],
      variations: []
    });
  }
}

/**
 * Type the EventEmitter properly
 */
export interface PersonalityGenerator {
  on<K extends keyof PersonalityEvents>(event: K, listener: (data: PersonalityEvents[K]) => void): this;
  emit<K extends keyof PersonalityEvents>(event: K, data: PersonalityEvents[K]): boolean;
}