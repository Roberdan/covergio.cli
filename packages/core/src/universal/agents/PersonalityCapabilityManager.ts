/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { PersonalityGenerator } from './personality/PersonalityGenerator.js';
import { CapabilityRegistry } from './capabilities/CapabilityRegistry.js';
import { IntegratedPersonality } from './personality/IntegratedPersonality.js';
import { IntegratedCapability } from './capabilities/IntegratedCapability.js';
import { 
  IPersonalityCapabilityManager, 
  IPersonality, 
  ICapability,
  PersonalityGenerationContext,
  CapabilityAssignmentContext,
  CompatibilityCheck,
  OptimizationRecommendation,
  PerformanceAnalytics,
  CompatibilityMatrix
} from './interfaces.js';

/**
 * Manager for coordinating personality and capability systems
 */
export class PersonalityCapabilityManager extends EventEmitter implements IPersonalityCapabilityManager {
  private personalityGenerator: PersonalityGenerator;
  private capabilityRegistry: CapabilityRegistry;
  private compatibilityMatrix: CompatibilityMatrix = {};
  private personalityCache = new Map<string, IPersonality>();
  private capabilityCache = new Map<string, ICapability>();
  private performanceHistory: Array<{
    timestamp: Date;
    personalityId: string;
    capabilities: string[];
    performance: number;
  }> = [];

  constructor(
    personalityGenerator?: PersonalityGenerator,
    capabilityRegistry?: CapabilityRegistry
  ) {
    super();
    
    this.personalityGenerator = personalityGenerator || new PersonalityGenerator();
    this.capabilityRegistry = capabilityRegistry || new CapabilityRegistry();
    
    this.initializeCompatibilityMatrix();
    this.setupEventListeners();
  }

  /**
   * Generate personality optimized for given capabilities
   */
  async generateOptimalPersonality(
    capabilities: string[],
    context: PersonalityGenerationContext
  ): Promise<IPersonality> {
    try {
      // Analyze required capabilities to determine optimal traits
      const optimalTraits = await this.analyzeOptimalTraits(capabilities);
      
      // Generate personality configuration
      const personalityConfig = {
        domain: context.domain,
        role: context.role,
        requirements: context.requirements,
        constraints: context.constraints,
        influenceFactors: this.createInfluenceFactors(capabilities, optimalTraits),
        compatibility: {
          mustInclude: ['helpful', 'professional'],
          preferredTraits: optimalTraits.map(t => t.name)
        }
      };

      // Generate base personality
      const baseProfile = await this.personalityGenerator.generatePersonality(personalityConfig);
      
      // Create integrated personality
      const integratedPersonality = new IntegratedPersonality(baseProfile);
      
      // Optimize for capabilities
      await this.optimizePersonalityForCapabilities(integratedPersonality, capabilities);
      
      // Cache the result
      this.personalityCache.set(integratedPersonality.id, integratedPersonality);
      
      this.emit('personality-generated', {
        personalityId: integratedPersonality.id,
        capabilities,
        context
      });

      return integratedPersonality;
      
    } catch (error) {
      this.emit('personality-generation-failed', {
        capabilities,
        context,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Assign capabilities optimized for given personality
   */
  async assignOptimalCapabilities(
    personalityId: string,
    context: CapabilityAssignmentContext
  ): Promise<ICapability[]> {
    try {
      const personality = this.personalityCache.get(personalityId);
      if (!personality) {
        throw new Error(`Personality not found: ${personalityId}`);
      }

      // Get compatible capabilities from personality
      const compatibleCapabilities = await personality.getCompatibleCapabilities();
      
      // Filter based on context requirements
      const requiredCapabilities = context.requiredCapabilities;
      const optionalCapabilities = context.optionalCapabilities || [];
      
      // Combine and prioritize capabilities
      const allCandidates = [...new Set([...requiredCapabilities, ...optionalCapabilities, ...compatibleCapabilities])];
      
      // Score capabilities based on personality compatibility
      const scoredCapabilities = await this.scoreCapabilities(personalityId, allCandidates);
      
      // Apply constraints
      const filteredCapabilities = this.applyConstraints(scoredCapabilities, context.constraints);
      
      // Optimize for performance requirements
      const optimizedCapabilities = await this.optimizeForPerformance(
        filteredCapabilities,
        context.performanceRequirements
      );

      // Convert to integrated capabilities
      const integratedCapabilities: ICapability[] = [];
      for (const capId of optimizedCapabilities) {
        const extendedCap = this.capabilityRegistry.getCapability(capId);
        if (extendedCap) {
          const integratedCap = new IntegratedCapability(extendedCap);
          this.capabilityCache.set(capId, integratedCap);
          integratedCapabilities.push(integratedCap);
        }
      }

      this.emit('capabilities-assigned', {
        personalityId,
        capabilities: optimizedCapabilities,
        context
      });

      return integratedCapabilities;
      
    } catch (error) {
      this.emit('capability-assignment-failed', {
        personalityId,
        context,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check compatibility between personality and capabilities
   */
  async checkCompatibility(
    personalityId: string,
    capabilities: string[]
  ): Promise<CompatibilityCheck> {
    const personality = this.personalityCache.get(personalityId);
    if (!personality) {
      throw new Error(`Personality not found: ${personalityId}`);
    }

    // Use personality's built-in compatibility check
    const result = await personality.isCompatibleWith(capabilities);
    
    // Enhance with matrix data
    const matrixScore = this.getMatrixCompatibilityScore(personalityId, capabilities);
    
    // Combine scores
    const combinedScore = (result.score + matrixScore) / 2;
    
    const enhancedResult: CompatibilityCheck = {
      ...result,
      score: combinedScore
    };

    this.emit('compatibility-checked', {
      personalityId,
      capabilities,
      result: enhancedResult
    });

    return enhancedResult;
  }

  /**
   * Get recommendations for improving compatibility
   */
  async getOptimizationRecommendations(
    personalityId: string,
    capabilities: string[]
  ): Promise<OptimizationRecommendation[]> {
    const compatibility = await this.checkCompatibility(personalityId, capabilities);
    const recommendations: OptimizationRecommendation[] = [];

    // Low compatibility recommendations
    if (compatibility.score < 0.6) {
      recommendations.push({
        type: 'personality',
        priority: 'high',
        description: 'Personality-capability alignment is below optimal threshold',
        impact: 'May result in reduced agent effectiveness and user satisfaction',
        implementation: 'Adjust personality traits or select different capabilities',
        estimatedImprovement: 0.3
      });
    }

    // Conflict-based recommendations
    for (const conflict of compatibility.conflicts) {
      recommendations.push({
        type: 'configuration',
        priority: 'high',
        description: `Resolve conflict: ${conflict}`,
        impact: 'Conflicts can cause inconsistent agent behavior',
        implementation: 'Modify conflicting traits or replace conflicting capabilities',
        estimatedImprovement: 0.2
      });
    }

    // Performance-based recommendations
    const personality = this.personalityCache.get(personalityId);
    if (personality) {
      for (const capability of capabilities) {
        const strengthScore = personality.getStrengthScore(this.getCapabilityDomain(capability));
        
        if (strengthScore < 0.5) {
          recommendations.push({
            type: 'capability',
            priority: 'medium',
            description: `Low strength score for ${capability} domain`,
            impact: 'May reduce effectiveness in this capability area',
            implementation: `Enhance personality traits related to ${capability}`,
            estimatedImprovement: 0.15
          });
        }
      }
    }

    // Historical performance recommendations
    const historicalData = this.getHistoricalPerformance(personalityId, capabilities);
    if (historicalData && historicalData.averagePerformance < 0.7) {
      recommendations.push({
        type: 'configuration',
        priority: 'medium',
        description: 'Historical performance below target',
        impact: 'Consistent underperformance may indicate misalignment',
        implementation: 'Review and adjust personality-capability combination',
        estimatedImprovement: 0.25
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Update compatibility matrix
   */
  async updateCompatibilityMatrix(
    personalityId: string,
    capabilityId: string,
    compatibility: number
  ): Promise<void> {
    if (!this.compatibilityMatrix[personalityId]) {
      this.compatibilityMatrix[personalityId] = {};
    }

    this.compatibilityMatrix[personalityId][capabilityId] = {
      compatibility,
      synergy: this.calculateSynergy(personalityId, capabilityId),
      conflicts: [],
      recommendations: []
    };

    this.emit('compatibility-matrix-updated', {
      personalityId,
      capabilityId,
      compatibility
    });
  }

  /**
   * Get performance analytics
   */
  async getAnalytics(): Promise<PerformanceAnalytics> {
    const totalAgents = this.personalityCache.size;
    
    // Calculate average compatibility score
    let totalCompatibility = 0;
    let compatibilityCount = 0;
    
    for (const personalityData of Object.values(this.compatibilityMatrix)) {
      for (const capabilityData of Object.values(personalityData)) {
        totalCompatibility += capabilityData.compatibility;
        compatibilityCount++;
      }
    }
    
    const averageCompatibilityScore = compatibilityCount > 0 ? totalCompatibility / compatibilityCount : 0;

    // Find top performing combinations
    const performanceCombinations = this.performanceHistory
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 5)
      .map(entry => ({
        personalityId: entry.personalityId,
        capabilities: entry.capabilities,
        score: entry.performance
      }));

    // Identify common issues
    const commonIssues = this.identifyCommonIssues();

    // Generate recommendations
    const recommendations = this.generateAnalyticsRecommendations(averageCompatibilityScore, commonIssues);

    // Create trend data
    const trendData = this.generateTrendData();

    return {
      totalAgents,
      averageCompatibilityScore,
      topPerformingCombinations: performanceCombinations,
      commonIssues,
      recommendations,
      trendData
    };
  }

  /**
   * Record performance data
   */
  recordPerformance(personalityId: string, capabilities: string[], performance: number): void {
    this.performanceHistory.push({
      timestamp: new Date(),
      personalityId,
      capabilities: [...capabilities],
      performance
    });

    // Keep only recent history (last 1000 entries)
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }

    this.emit('performance-recorded', {
      personalityId,
      capabilities,
      performance
    });
  }

  /**
   * Get compatibility matrix
   */
  getCompatibilityMatrix(): CompatibilityMatrix {
    return JSON.parse(JSON.stringify(this.compatibilityMatrix));
  }

  /**
   * Private helper methods
   */
  private async analyzeOptimalTraits(capabilities: string[]): Promise<Array<{ name: string; value: number }>> {
    const traitRequirements = new Map<string, number>();

    for (const capability of capabilities) {
      // Map capabilities to required traits
      const requiredTraits = this.getRequiredTraits(capability);
      
      for (const [trait, importance] of requiredTraits) {
        const current = traitRequirements.get(trait) || 0;
        traitRequirements.set(trait, Math.max(current, importance));
      }
    }

    return Array.from(traitRequirements.entries()).map(([name, value]) => ({ name, value }));
  }

  private getRequiredTraits(capability: string): Map<string, number> {
    const traits = new Map<string, number>();

    // Map capability patterns to traits
    if (capability.includes('technical') || capability.includes('programming')) {
      traits.set('analytical', 0.8);
      traits.set('methodical', 0.7);
      traits.set('detail-oriented', 0.7);
    }

    if (capability.includes('creative') || capability.includes('design')) {
      traits.set('creative', 0.9);
      traits.set('imaginative', 0.8);
      traits.set('open-minded', 0.7);
    }

    if (capability.includes('communication') || capability.includes('customer')) {
      traits.set('empathetic', 0.8);
      traits.set('helpful', 0.9);
      traits.set('patient', 0.7);
    }

    if (capability.includes('leadership') || capability.includes('management')) {
      traits.set('assertive', 0.8);
      traits.set('decisive', 0.7);
      traits.set('inspiring', 0.6);
    }

    if (capability.includes('analysis') || capability.includes('research')) {
      traits.set('analytical', 0.9);
      traits.set('methodical', 0.8);
      traits.set('thorough', 0.7);
    }

    return traits;
  }

  private createInfluenceFactors(
    capabilities: string[],
    optimalTraits: Array<{ name: string; value: number }>
  ): Record<string, number> {
    const factors: Record<string, number> = {};

    for (const trait of optimalTraits) {
      factors[trait.name] = (trait.value - 0.5) * 0.5; // Convert to influence factor
    }

    return factors;
  }

  private async optimizePersonalityForCapabilities(
    personality: IPersonality,
    capabilities: string[]
  ): Promise<void> {
    const compatibility = await personality.isCompatibleWith(capabilities);
    
    // If compatibility is low, suggest trait adjustments
    if (compatibility.score < 0.7) {
      for (const capability of capabilities) {
        const requiredTraits = this.getRequiredTraits(capability);
        
        for (const [traitName, targetValue] of requiredTraits) {
          const currentTrait = personality.traits.find(t => t.name === traitName);
          if (currentTrait && currentTrait.value < targetValue - 0.2) {
            // Gradually adjust toward target
            const adjustment = Math.min(0.1, (targetValue - currentTrait.value) * 0.5);
            await personality.updateTrait(traitName, currentTrait.value + adjustment);
          }
        }
      }
    }
  }

  private async scoreCapabilities(personalityId: string, capabilities: string[]): Promise<string[]> {
    const scored: Array<{ id: string; score: number }> = [];

    for (const capId of capabilities) {
      let score = 0.5; // Base score

      // Matrix compatibility score
      const matrixScore = this.getMatrixCompatibilityScore(personalityId, [capId]);
      score += matrixScore * 0.3;

      // Capability metrics score
      const capability = this.capabilityRegistry.getCapability(capId);
      if (capability?.metrics) {
        score += capability.metrics.successRate * 0.2;
        score -= capability.metrics.errorRate * 0.1;
      }

      // Historical performance score
      const historical = this.getHistoricalPerformance(personalityId, [capId]);
      if (historical) {
        score += historical.averagePerformance * 0.2;
      }

      scored.push({ id: capId, score });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.id);
  }

  private applyConstraints(capabilities: string[], constraints: string[]): string[] {
    return capabilities.filter(cap => {
      return !constraints.some(constraint => {
        if (constraint.startsWith('NOT ')) {
          return cap.includes(constraint.substring(4));
        }
        return false;
      });
    });
  }

  private async optimizeForPerformance(
    capabilities: string[],
    performanceRequirements: Record<string, number>
  ): Promise<string[]> {
    const optimized: string[] = [];
    let currentComplexity = 0;
    const maxComplexity = performanceRequirements.maxComplexity || 10;

    for (const cap of capabilities) {
      const capability = this.capabilityRegistry.getCapability(cap);
      if (!capability) continue;

      const complexity = this.calculateCapabilityComplexity(capability);
      
      if (currentComplexity + complexity <= maxComplexity) {
        optimized.push(cap);
        currentComplexity += complexity;
      }
    }

    return optimized;
  }

  private calculateCapabilityComplexity(capability: any): number {
    const levelComplexity = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    return levelComplexity[capability.level as keyof typeof levelComplexity] || 2;
  }

  private getMatrixCompatibilityScore(personalityId: string, capabilities: string[]): number {
    const personalityData = this.compatibilityMatrix[personalityId];
    if (!personalityData) return 0.5;

    let totalScore = 0;
    let count = 0;

    for (const cap of capabilities) {
      const capData = personalityData[cap];
      if (capData) {
        totalScore += capData.compatibility;
        count++;
      }
    }

    return count > 0 ? totalScore / count : 0.5;
  }

  private getHistoricalPerformance(personalityId: string, capabilities: string[]): { averagePerformance: number } | null {
    const relevantHistory = this.performanceHistory.filter(entry =>
      entry.personalityId === personalityId &&
      capabilities.every(cap => entry.capabilities.includes(cap))
    );

    if (relevantHistory.length === 0) return null;

    const averagePerformance = relevantHistory.reduce((sum, entry) => sum + entry.performance, 0) / relevantHistory.length;
    
    return { averagePerformance };
  }

  private calculateSynergy(personalityId: string, capabilityId: string): number {
    // Simple synergy calculation based on naming patterns
    if (personalityId.includes('analytical') && capabilityId.includes('analysis')) return 0.8;
    if (personalityId.includes('creative') && capabilityId.includes('creative')) return 0.8;
    if (personalityId.includes('supportive') && capabilityId.includes('support')) return 0.8;
    return 0.5;
  }

  private getCapabilityDomain(capability: string): string {
    if (capability.includes('technical')) return 'technical';
    if (capability.includes('creative')) return 'creative';
    if (capability.includes('business')) return 'business';
    if (capability.includes('social')) return 'social';
    if (capability.includes('analytical')) return 'analytical';
    return 'general';
  }

  private identifyCommonIssues(): string[] {
    const issues: string[] = [];
    
    // Analyze performance history for patterns
    const lowPerformanceEntries = this.performanceHistory.filter(entry => entry.performance < 0.6);
    
    if (lowPerformanceEntries.length > this.performanceHistory.length * 0.3) {
      issues.push('High frequency of low-performance combinations');
    }

    // Check compatibility matrix for common conflicts
    let conflictCount = 0;
    for (const personalityData of Object.values(this.compatibilityMatrix)) {
      for (const capabilityData of Object.values(personalityData)) {
        if (capabilityData.compatibility < 0.6) conflictCount++;
      }
    }

    if (conflictCount > 0) {
      issues.push('Multiple personality-capability compatibility issues detected');
    }

    return issues;
  }

  private generateAnalyticsRecommendations(averageScore: number, issues: string[]): string[] {
    const recommendations: string[] = [];

    if (averageScore < 0.7) {
      recommendations.push('Consider reviewing default personality-capability combinations');
    }

    if (issues.length > 2) {
      recommendations.push('Implement systematic compatibility testing for new combinations');
    }

    recommendations.push('Regular monitoring of performance metrics recommended');
    
    return recommendations;
  }

  private generateTrendData(): { timeframe: string; metrics: Record<string, number[]> } {
    const timeframe = 'last-30-days';
    const metrics: Record<string, number[]> = {};

    // Generate mock trend data for now
    metrics.compatibilityScore = Array.from({ length: 30 }, () => 0.6 + Math.random() * 0.3);
    metrics.performanceScore = Array.from({ length: 30 }, () => 0.7 + Math.random() * 0.2);
    metrics.usageCount = Array.from({ length: 30 }, () => Math.floor(Math.random() * 50));

    return { timeframe, metrics };
  }

  private initializeCompatibilityMatrix(): void {
    // Initialize with some default compatibility scores
    this.compatibilityMatrix = {
      'analytical': {
        'data-analysis': { compatibility: 0.9, synergy: 0.8, conflicts: [], recommendations: [] },
        'programming': { compatibility: 0.8, synergy: 0.7, conflicts: [], recommendations: [] },
        'creative-writing': { compatibility: 0.4, synergy: 0.2, conflicts: ['different thinking styles'], recommendations: [] }
      },
      'creative': {
        'creative-writing': { compatibility: 0.9, synergy: 0.9, conflicts: [], recommendations: [] },
        'design': { compatibility: 0.8, synergy: 0.8, conflicts: [], recommendations: [] },
        'data-analysis': { compatibility: 0.5, synergy: 0.3, conflicts: ['different approaches'], recommendations: [] }
      },
      'supportive': {
        'customer-service': { compatibility: 0.9, synergy: 0.8, conflicts: [], recommendations: [] },
        'communication': { compatibility: 0.8, synergy: 0.8, conflicts: [], recommendations: [] },
        'leadership': { compatibility: 0.6, synergy: 0.4, conflicts: ['different authority styles'], recommendations: [] }
      }
    };
  }

  private setupEventListeners(): void {
    this.personalityGenerator.on('personality-generated', (data) => {
      this.emit('personality-created', data);
    });

    this.capabilityRegistry.on('capability-registered', (data) => {
      this.emit('capability-registered', data);
    });
  }
}

/**
 * Manager events interface
 */
export interface PersonalityCapabilityManagerEvents {
  'personality-generated': { personalityId: string; capabilities: string[]; context: PersonalityGenerationContext };
  'personality-generation-failed': { capabilities: string[]; context: PersonalityGenerationContext; error: string };
  'capabilities-assigned': { personalityId: string; capabilities: string[]; context: CapabilityAssignmentContext };
  'capability-assignment-failed': { personalityId: string; context: CapabilityAssignmentContext; error: string };
  'compatibility-checked': { personalityId: string; capabilities: string[]; result: CompatibilityCheck };
  'compatibility-matrix-updated': { personalityId: string; capabilityId: string; compatibility: number };
  'performance-recorded': { personalityId: string; capabilities: string[]; performance: number };
  'personality-created': any;
  'capability-registered': any;
}

/**
 * Type the EventEmitter properly
 */
export interface PersonalityCapabilityManager {
  on<K extends keyof PersonalityCapabilityManagerEvents>(event: K, listener: (data: PersonalityCapabilityManagerEvents[K]) => void): this;
  emit<K extends keyof PersonalityCapabilityManagerEvents>(event: K, data: PersonalityCapabilityManagerEvents[K]): boolean;
}