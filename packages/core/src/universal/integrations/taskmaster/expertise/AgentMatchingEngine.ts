/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AgentSpecification,
  AgentMatchingCriteria,
  AgentMatchingResult,
  ScoreBreakdown,
  MatchingWeights,
  ExpertiseIdentificationConfig,
  Capability,
  PersonalityTrait
} from './types.js';
import { AgentSpecificationRegistry } from './AgentSpecificationRegistry.js';

/**
 * Engine for matching agents to task requirements
 */
export class AgentMatchingEngine {
  private registry: AgentSpecificationRegistry;
  private config: ExpertiseIdentificationConfig;

  constructor(registry: AgentSpecificationRegistry, config: ExpertiseIdentificationConfig) {
    this.registry = registry;
    this.config = config;
  }

  /**
   * Find agents that match the given criteria
   */
  async findMatches(criteria: AgentMatchingCriteria): Promise<AgentMatchingResult[]> {
    const candidates = this.getCandidates(criteria);
    const results: AgentMatchingResult[] = [];

    for (const candidate of candidates) {
      const result = await this.scoreAgent(candidate, criteria);
      if (result.score >= (criteria.minConfidence || 0.5)) {
        results.push(result);
      }
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    // Limit results
    const maxMatches = criteria.maxMatches || 10;
    return results.slice(0, maxMatches);
  }

  /**
   * Score a single agent against criteria
   */
  async scoreAgent(
    specification: AgentSpecification, 
    criteria: AgentMatchingCriteria
  ): Promise<AgentMatchingResult> {
    const weights = criteria.weights || this.config.defaultWeights;
    
    // Calculate individual scores
    const capabilityScore = this.scoreCapabilities(specification, criteria);
    const domainScore = this.scoreDomain(specification, criteria);
    const experienceScore = this.scoreExperience(specification);
    const personalityScore = this.scorePersonality(specification);
    const toolScore = this.scoreTools(specification);

    // Calculate weighted total
    const totalScore = (
      capabilityScore * weights.capabilities +
      domainScore * weights.domain +
      experienceScore * weights.experience +
      personalityScore * weights.personality +
      toolScore * weights.tools
    );

    const scoreBreakdown: ScoreBreakdown = {
      capabilities: capabilityScore,
      domain: domainScore,
      experience: experienceScore,
      personality: personalityScore,
      tools: toolScore,
      total: totalScore
    };

    return {
      specification,
      score: totalScore,
      scoreBreakdown,
      matchReasons: this.generateMatchReasons(specification, criteria, scoreBreakdown),
      concerns: this.identifyConcerns(specification, criteria, scoreBreakdown),
      recommendation: this.getRecommendationLevel(totalScore)
    };
  }

  /**
   * Get candidate agents based on basic filtering
   */
  private getCandidates(criteria: AgentMatchingCriteria): AgentSpecification[] {
    let candidates = this.registry.getAll();

    // Filter by domains if specified
    if (criteria.domains && criteria.domains.length > 0) {
      candidates = candidates.filter(spec =>
        criteria.domains!.includes(spec.domain)
      );
    }

    // Basic capability filtering
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      candidates = candidates.filter(spec =>
        criteria.requiredCapabilities!.some(reqCap =>
          spec.capabilities.some(cap => cap.id === reqCap)
        )
      );
    }

    return candidates;
  }

  /**
   * Score capabilities match
   */
  private scoreCapabilities(
    specification: AgentSpecification, 
    criteria: AgentMatchingCriteria
  ): number {
    const requiredCaps = criteria.requiredCapabilities || [];
    const optionalCaps = criteria.optionalCapabilities || [];
    const specCapIds = specification.capabilities.map(cap => cap.id);

    if (requiredCaps.length === 0 && optionalCaps.length === 0) {
      return 0.7; // Neutral score when no specific capabilities requested
    }

    let score = 0;
    let maxScore = 0;

    // Required capabilities (higher weight)
    for (const reqCap of requiredCaps) {
      maxScore += 1.0;
      if (specCapIds.includes(reqCap)) {
        const capability = specification.capabilities.find(cap => cap.id === reqCap);
        if (capability) {
          score += this.getCapabilityLevelMultiplier(capability);
        }
      }
    }

    // Optional capabilities (lower weight)
    for (const optCap of optionalCaps) {
      maxScore += 0.5;
      if (specCapIds.includes(optCap)) {
        const capability = specification.capabilities.find(cap => cap.id === optCap);
        if (capability) {
          score += this.getCapabilityLevelMultiplier(capability) * 0.5;
        }
      }
    }

    return maxScore > 0 ? Math.min(1, score / maxScore) : 0;
  }

  /**
   * Get multiplier based on capability level
   */
  private getCapabilityLevelMultiplier(capability: Capability): number {
    switch (capability.level) {
      case 'beginner': return 0.6;
      case 'intermediate': return 0.8;
      case 'advanced': return 1.0;
      case 'expert': return 1.2;
      case 'master': return 1.4;
      default: return 0.8;
    }
  }

  /**
   * Score domain match
   */
  private scoreDomain(
    specification: AgentSpecification, 
    criteria: AgentMatchingCriteria
  ): number {
    const domains = criteria.domains || [];
    
    if (domains.length === 0) {
      return 0.7; // Neutral score when no specific domain requested
    }

    // Exact domain match
    if (domains.includes(specification.domain)) {
      return 1.0;
    }

    // Check for related domains
    const relatedScore = this.getRelatedDomainScore(specification.domain, domains);
    if (relatedScore > 0) {
      return relatedScore;
    }

    // No domain match
    return 0.2;
  }

  /**
   * Get score for related domains
   */
  private getRelatedDomainScore(specDomain: string, requestedDomains: string[]): number {
    const domainRelations: Record<string, string[]> = {
      'web-development': ['frontend-development', 'fullstack-development'],
      'backend-development': ['api-development', 'fullstack-development'],
      'data-science': ['machine-learning', 'analytics'],
      'devops': ['cloud-infrastructure', 'deployment'],
      'design': ['ui-design', 'ux-design', 'visual-design']
    };

    for (const requestedDomain of requestedDomains) {
      const related = domainRelations[requestedDomain] || [];
      if (related.includes(specDomain)) {
        return 0.7; // Good match for related domain
      }
      
      // Check reverse relation
      const specRelated = domainRelations[specDomain] || [];
      if (specRelated.includes(requestedDomain)) {
        return 0.7;
      }
    }

    return 0;
  }

  /**
   * Score experience level based on overall confidence
   */
  private scoreExperience(specification: AgentSpecification): number {
    // Use the specification's confidence as experience indicator
    return specification.confidence;
  }

  /**
   * Score personality fit
   */
  private scorePersonality(specification: AgentSpecification): number {
    if (specification.personalityTraits.length === 0) {
      return 0.5; // Neutral score for no personality info
    }

    // For now, give higher scores to agents with more balanced personalities
    // In the future, this could be matched against task requirements
    const traitStrengths = specification.personalityTraits.map(trait => trait.strength);
    const avgStrength = traitStrengths.reduce((sum, strength) => sum + strength, 0) / traitStrengths.length;
    
    // Prefer balanced traits (not too extreme)
    if (avgStrength >= 0.6 && avgStrength <= 0.9) {
      return 0.8;
    } else if (avgStrength >= 0.4 && avgStrength < 0.6) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  /**
   * Score available tools
   */
  private scoreTools(specification: AgentSpecification): number {
    if (specification.tools.length === 0) {
      return 0.3; // Lower score for no tools
    }

    // More tools generally better, but with diminishing returns
    const toolCount = specification.tools.length;
    const normalizedCount = Math.min(toolCount / 10, 1); // Normalize to 0-1 scale
    
    return 0.3 + (normalizedCount * 0.7); // Range from 0.3 to 1.0
  }

  /**
   * Generate reasons for the match
   */
  private generateMatchReasons(
    specification: AgentSpecification,
    criteria: AgentMatchingCriteria,
    scores: ScoreBreakdown
  ): string[] {
    const reasons: string[] = [];

    // Capability matches
    if (scores.capabilities > 0.7) {
      const matchedCaps = this.getMatchedCapabilities(specification, criteria);
      if (matchedCaps.length > 0) {
        reasons.push(`Strong capability match: ${matchedCaps.slice(0, 3).join(', ')}`);
      }
    }

    // Domain match
    if (scores.domain > 0.8) {
      reasons.push(`Exact domain match: ${specification.domain}`);
    } else if (scores.domain > 0.6) {
      reasons.push(`Related domain expertise: ${specification.domain}`);
    }

    // Experience
    if (scores.experience > 0.8) {
      reasons.push(`High experience level (${Math.round(scores.experience * 100)}% confidence)`);
    }

    // Tools
    if (scores.tools > 0.7 && specification.tools.length > 0) {
      reasons.push(`Well-equipped with ${specification.tools.length} relevant tools`);
    }

    // Personality
    if (scores.personality > 0.7) {
      const topTraits = specification.personalityTraits
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 2)
        .map(trait => trait.name);
      reasons.push(`Good personality fit: ${topTraits.join(', ')}`);
    }

    return reasons.length > 0 ? reasons : ['General capability match'];
  }

  /**
   * Get matched capabilities
   */
  private getMatchedCapabilities(
    specification: AgentSpecification,
    criteria: AgentMatchingCriteria
  ): string[] {
    const requiredCaps = criteria.requiredCapabilities || [];
    const optionalCaps = criteria.optionalCapabilities || [];
    const allRequestedCaps = [...requiredCaps, ...optionalCaps];
    
    const specCapIds = specification.capabilities.map(cap => cap.id);
    
    return allRequestedCaps.filter(cap => specCapIds.includes(cap));
  }

  /**
   * Identify potential concerns
   */
  private identifyConcerns(
    specification: AgentSpecification,
    criteria: AgentMatchingCriteria,
    scores: ScoreBreakdown
  ): string[] {
    const concerns: string[] = [];

    // Low capability match
    if (scores.capabilities < 0.5) {
      const missingCaps = this.getMissingCapabilities(specification, criteria);
      if (missingCaps.length > 0) {
        concerns.push(`Missing capabilities: ${missingCaps.slice(0, 3).join(', ')}`);
      }
    }

    // Domain mismatch
    if (scores.domain < 0.4) {
      concerns.push(`Domain mismatch: specializes in ${specification.domain}`);
    }

    // Low experience
    if (scores.experience < 0.5) {
      concerns.push(`Lower confidence level (${Math.round(scores.experience * 100)}%)`);
    }

    // Limited tools
    if (scores.tools < 0.4) {
      concerns.push('Limited tool availability');
    }

    // Overall low score
    if (scores.total < 0.6) {
      concerns.push('Overall match confidence is moderate');
    }

    return concerns;
  }

  /**
   * Get missing capabilities
   */
  private getMissingCapabilities(
    specification: AgentSpecification,
    criteria: AgentMatchingCriteria
  ): string[] {
    const requiredCaps = criteria.requiredCapabilities || [];
    const specCapIds = specification.capabilities.map(cap => cap.id);
    
    return requiredCaps.filter(cap => !specCapIds.includes(cap));
  }

  /**
   * Get recommendation level based on score
   */
  private getRecommendationLevel(score: number): 'highly-recommended' | 'recommended' | 'suitable' | 'fallback' {
    if (score >= 0.85) return 'highly-recommended';
    if (score >= 0.7) return 'recommended';
    if (score >= 0.5) return 'suitable';
    return 'fallback';
  }

  /**
   * Explain a match result in detail
   */
  async explainMatch(result: AgentMatchingResult): Promise<string> {
    const lines: string[] = [];
    
    lines.push(`## Agent Match Analysis: ${result.specification.role}`);
    lines.push(`**Overall Score:** ${Math.round(result.score * 100)}% (${result.recommendation})`);
    lines.push('');
    
    lines.push('### Score Breakdown:');
    lines.push(`- **Capabilities:** ${Math.round(result.scoreBreakdown.capabilities * 100)}%`);
    lines.push(`- **Domain:** ${Math.round(result.scoreBreakdown.domain * 100)}%`);
    lines.push(`- **Experience:** ${Math.round(result.scoreBreakdown.experience * 100)}%`);
    lines.push(`- **Personality:** ${Math.round(result.scoreBreakdown.personality * 100)}%`);
    lines.push(`- **Tools:** ${Math.round(result.scoreBreakdown.tools * 100)}%`);
    lines.push('');

    if (result.matchReasons.length > 0) {
      lines.push('### Strengths:');
      result.matchReasons.forEach(reason => lines.push(`- ${reason}`));
      lines.push('');
    }

    if (result.concerns && result.concerns.length > 0) {
      lines.push('### Concerns:');
      result.concerns.forEach(concern => lines.push(`- ${concern}`));
      lines.push('');
    }

    lines.push('### Agent Details:');
    lines.push(`- **Domain:** ${result.specification.domain}`);
    lines.push(`- **Capabilities:** ${result.specification.capabilities.map(cap => cap.name).join(', ')}`);
    lines.push(`- **Tools:** ${result.specification.tools.map(tool => tool.name).join(', ')}`);
    
    return lines.join('\n');
  }

  /**
   * Get matching statistics
   */
  getMatchingStats() {
    const allSpecs = this.registry.getAll();
    
    return {
      totalAgents: allSpecs.length,
      domainDistribution: this.registry.getAllDomains().reduce((acc, domain) => {
        acc[domain] = this.registry.findByDomain(domain).length;
        return acc;
      }, {} as Record<string, number>),
      capabilityDistribution: this.getCapabilityStats(),
      averageConfidence: allSpecs.reduce((sum, spec) => sum + spec.confidence, 0) / allSpecs.length
    };
  }

  /**
   * Get capability statistics
   */
  private getCapabilityStats() {
    const allCaps = this.registry.getAllCapabilities();
    const stats: Record<string, number> = {};
    
    allCaps.forEach(cap => {
      stats[cap.category] = (stats[cap.category] || 0) + 1;
    });
    
    return stats;
  }
}