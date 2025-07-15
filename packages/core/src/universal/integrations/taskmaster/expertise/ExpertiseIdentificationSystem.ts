/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { TaskMasterClient } from '../TaskMasterClient.js';
import {
  ExpertiseIdentificationInput,
  ExpertiseIdentificationResult,
  ExpertiseIdentificationConfig,
  ExpertiseAnalysis,
  AgentSpecification,
  Capability,
  ComplexityAssessment,
  RiskFactor,
  ResourceRequirement,
  TimelineConsideration,
  FallbackStrategy,
  ExpertiseIdentificationEvents
} from './types.js';
import { AgentSpecificationRegistry } from './AgentSpecificationRegistry.js';
import { AgentMatchingEngine } from './AgentMatchingEngine.js';

/**
 * System for identifying required expertise and specifying appropriate agents
 */
export class ExpertiseIdentificationSystem extends EventEmitter {
  private client: TaskMasterClient;
  private registry: AgentSpecificationRegistry;
  private matchingEngine: AgentMatchingEngine;
  private config: ExpertiseIdentificationConfig;
  private cache = new Map<string, ExpertiseIdentificationResult>();

  constructor(
    client: TaskMasterClient,
    registry: AgentSpecificationRegistry,
    config: Partial<ExpertiseIdentificationConfig> = {}
  ) {
    super();
    this.client = client;
    this.registry = registry;
    this.config = this.mergeConfig(config);
    this.matchingEngine = new AgentMatchingEngine(registry, this.config);
  }

  /**
   * Identify required expertise for a task
   */
  async identifyExpertise(input: ExpertiseIdentificationInput): Promise<ExpertiseIdentificationResult> {
    const startTime = Date.now();
    
    this.emit('identification-started', { input });

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(input);
      if (this.config.enableCaching && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        if (Date.now() - cached.metadata.timestamp.getTime() < this.config.cacheTimeout) {
          this.emit('cache-hit', { key: cacheKey });
          return cached;
        } else {
          this.cache.delete(cacheKey);
        }
      }

      this.emit('cache-miss', { key: cacheKey });

      // Analyze the task to understand requirements
      const analysis = await this.analyzeTaskRequirements(input);

      // Find matching agent specifications
      const specifications = await this.findMatchingAgents(analysis, input);

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(specifications, analysis);

      // Apply fallback strategies if needed
      const finalSpecifications = await this.applyFallbackStrategies(
        specifications, 
        analysis, 
        input, 
        confidence
      );

      const result: ExpertiseIdentificationResult = {
        input,
        specifications: finalSpecifications,
        analysis,
        confidence,
        alternatives: specifications.slice(finalSpecifications.length),
        reasoning: this.generateReasoning(finalSpecifications, analysis),
        metadata: {
          processingTime: Date.now() - startTime,
          specificationsEvaluated: this.registry.getAll().length,
          algorithmVersion: '1.0.0',
          timestamp: new Date(),
          configuration: this.config
        }
      };

      // Cache the result
      if (this.config.enableCaching) {
        this.cache.set(cacheKey, result);
      }

      this.emit('identification-completed', { result });
      return result;

    } catch (error) {
      this.emit('identification-failed', { error: error as Error, input });
      throw error;
    }
  }

  /**
   * Analyze task requirements using AI and rule-based approaches
   */
  private async analyzeTaskRequirements(input: ExpertiseIdentificationInput): Promise<ExpertiseAnalysis> {
    if (this.config.useAI) {
      this.emit('ai-analysis-started', { input });
      
      try {
        // Use Task Master AI for enhanced analysis
        const aiResult = await this.client.identifyExpertise(input.task, {
          context: input.context,
          analysisType: 'expertise-identification'
        });

        if (aiResult.response && aiResult.response.analysis) {
          const analysis = this.convertAIAnalysisToExpertiseAnalysis(aiResult.response.analysis);
          this.emit('ai-analysis-completed', { analysis });
          return analysis;
        }
      } catch (error) {
        console.warn('AI analysis failed, falling back to rule-based analysis:', error);
      }
    }

    // Fallback to rule-based analysis
    return this.performRuleBasedAnalysis(input);
  }

  /**
   * Convert AI analysis result to our expertise analysis format
   */
  private convertAIAnalysisToExpertiseAnalysis(aiAnalysis: any): ExpertiseAnalysis {
    return {
      domains: aiAnalysis.domains || [],
      requiredCapabilities: this.extractCapabilitiesFromAI(aiAnalysis.requiredCapabilities || []),
      optionalCapabilities: [],
      complexity: this.createComplexityAssessment(aiAnalysis.complexity, aiAnalysis.reasoning),
      riskFactors: this.extractRiskFactors(aiAnalysis.riskFactors || []),
      resourceRequirements: this.estimateResourceRequirements(aiAnalysis),
      timeline: this.extractTimelineConsiderations(aiAnalysis)
    };
  }

  /**
   * Extract capabilities from AI analysis
   */
  private extractCapabilitiesFromAI(aiCapabilities: string[]): Capability[] {
    return aiCapabilities.map((capability, index) => ({
      id: `ai-capability-${index}`,
      name: capability,
      category: this.inferCapabilityCategory(capability),
      level: 'intermediate',
      importance: 'high',
      keywords: [capability.toLowerCase(), capability.replace(/[-_]/g, ' ').toLowerCase()],
      description: `${capability} capability identified by AI analysis`
    }));
  }

  /**
   * Infer capability category from capability name
   */
  private inferCapabilityCategory(capability: string): any {
    const technical = ['coding', 'programming', 'development', 'api', 'database', 'system'];
    const creative = ['design', 'creative', 'visual', 'artistic', 'content'];
    const analytical = ['analysis', 'data', 'research', 'statistics', 'modeling'];
    const communication = ['communication', 'writing', 'presentation', 'documentation'];

    const lower = capability.toLowerCase();
    
    if (technical.some(term => lower.includes(term))) return 'technical';
    if (creative.some(term => lower.includes(term))) return 'creative';
    if (analytical.some(term => lower.includes(term))) return 'analytical';
    if (communication.some(term => lower.includes(term))) return 'communication';
    
    return 'domain-specific';
  }

  /**
   * Create complexity assessment
   */
  private createComplexityAssessment(complexity: string, reasoning: string): ComplexityAssessment {
    const complexityMap: Record<string, any> = {
      'simple': { score: 2, level: 'simple' },
      'medium': { score: 5, level: 'medium' },
      'complex': { score: 8, level: 'complex' },
      'expert': { score: 10, level: 'expert' }
    };

    const mapped = complexityMap[complexity] || complexityMap['medium'];

    return {
      overall: mapped.level,
      score: mapped.score,
      reasoning: reasoning || `Task assessed as ${complexity} complexity`,
      factors: [
        {
          name: 'Task Complexity',
          impact: complexity === 'simple' ? 'low' : complexity === 'expert' ? 'high' : 'medium',
          weight: 1.0,
          description: `Overall task complexity level: ${complexity}`
        }
      ]
    };
  }

  /**
   * Extract risk factors from AI analysis
   */
  private extractRiskFactors(aiRiskFactors: string[]): RiskFactor[] {
    return aiRiskFactors.map(risk => ({
      type: this.inferRiskType(risk),
      severity: 'medium',
      probability: 'medium',
      description: risk,
      mitigation: [`Monitor and mitigate ${risk}`]
    }));
  }

  /**
   * Infer risk type from risk description
   */
  private inferRiskType(risk: string): any {
    const lower = risk.toLowerCase();
    
    if (lower.includes('technical') || lower.includes('system') || lower.includes('integration')) {
      return 'technical';
    }
    if (lower.includes('business') || lower.includes('market') || lower.includes('financial')) {
      return 'business';
    }
    if (lower.includes('operational') || lower.includes('process') || lower.includes('workflow')) {
      return 'operational';
    }
    
    return 'strategic';
  }

  /**
   * Estimate resource requirements
   */
  private estimateResourceRequirements(aiAnalysis: any): ResourceRequirement[] {
    const requirements: ResourceRequirement[] = [];

    // Estimate human resources based on complexity
    if (aiAnalysis.estimatedDuration) {
      requirements.push({
        type: 'human',
        amount: Math.ceil(aiAnalysis.estimatedDuration / 3600), // Convert seconds to hours
        unit: 'hours',
        priority: 'high',
        description: 'Estimated human effort required'
      });
    }

    // Estimate computational resources for complex tasks
    if (aiAnalysis.complexity === 'complex' || aiAnalysis.complexity === 'expert') {
      requirements.push({
        type: 'computational',
        amount: 2,
        unit: 'cores',
        priority: 'medium',
        description: 'Additional computational resources for complex processing'
      });
    }

    return requirements;
  }

  /**
   * Extract timeline considerations
   */
  private extractTimelineConsiderations(aiAnalysis: any): TimelineConsideration[] {
    const considerations: TimelineConsideration[] = [];

    if (aiAnalysis.estimatedDuration) {
      considerations.push({
        type: 'milestone',
        impact: 'neutral',
        description: `Estimated completion time: ${aiAnalysis.estimatedDuration} seconds`,
        timeImpact: aiAnalysis.estimatedDuration * 1000
      });
    }

    return considerations;
  }

  /**
   * Perform rule-based analysis when AI is not available
   */
  private performRuleBasedAnalysis(input: ExpertiseIdentificationInput): ExpertiseAnalysis {
    const task = input.task.toLowerCase();
    const domains: string[] = [];
    const capabilities: Capability[] = [];

    // Simple keyword-based domain detection
    if (task.includes('web') || task.includes('frontend') || task.includes('react')) {
      domains.push('web-development');
      capabilities.push(this.createCapability('react-development', 'React Development'));
      if (task.includes('typescript')) {
        capabilities.push(this.createCapability('typescript', 'TypeScript'));
      }
    }
    
    if (task.includes('api') || task.includes('backend') || task.includes('server')) {
      domains.push('backend-development');
      capabilities.push(this.createCapability('api-development', 'API Development'));
      if (task.includes('node') || task.includes('nodejs')) {
        capabilities.push(this.createCapability('nodejs', 'Node.js Development'));
      }
    }

    if (task.includes('data') || task.includes('analysis') || task.includes('ml')) {
      domains.push('data-science');
      capabilities.push(this.createCapability('data-analysis', 'Data Analysis'));
      if (task.includes('python')) {
        capabilities.push(this.createCapability('python-programming', 'Python Programming'));
      }
    }

    if (task.includes('deploy') || task.includes('docker') || task.includes('kubernetes')) {
      domains.push('devops');
      capabilities.push(this.createCapability('container-orchestration', 'Container Orchestration'));
    }

    // Default complexity assessment
    const complexity = this.assessComplexityFromText(task);

    return {
      domains: domains.length > 0 ? domains : ['general'],
      requiredCapabilities: capabilities.length > 0 ? capabilities : [
        this.createCapability('general-problem-solving', 'General problem solving')
      ],
      optionalCapabilities: [],
      complexity,
      riskFactors: [],
      resourceRequirements: [
        {
          type: 'human',
          amount: 1,
          unit: 'developer',
          priority: 'high',
          description: 'Primary developer resource'
        }
      ],
      timeline: [
        {
          type: 'milestone',
          impact: 'neutral',
          description: 'Task completion',
          timeImpact: 3600000 // 1 hour default
        }
      ]
    };
  }

  /**
   * Create a capability object
   */
  private createCapability(id: string, name: string): Capability {
    return {
      id,
      name,
      category: 'technical',
      level: 'intermediate',
      importance: 'high',
      keywords: [id.replace(/[-_]/g, ' '), name.toLowerCase()],
      description: `${name} capability`
    };
  }

  /**
   * Assess complexity from task text
   */
  private assessComplexityFromText(task: string): ComplexityAssessment {
    let score = 3; // Default medium complexity
    
    // Increase complexity for certain keywords
    const complexKeywords = ['machine learning', 'ai', 'distributed', 'microservices', 'blockchain', 'full-stack', 'architecture', 'scaling', 'optimization'];
    const simpleKeywords = ['simple', 'basic', 'quick', 'small', 'easy'];
    
    complexKeywords.forEach(keyword => {
      if (task.toLowerCase().includes(keyword)) score += 2;
    });
    
    simpleKeywords.forEach(keyword => {
      if (task.toLowerCase().includes(keyword)) score -= 1;
    });
    
    // Additional complexity factors
    if (task.toLowerCase().includes('multiple') || task.toLowerCase().includes('several')) score += 1;
    if (task.split(' ').length > 15) score += 1; // Long descriptions tend to be more complex
    
    score = Math.max(1, Math.min(10, score));
    
    let level: any = 'medium';
    if (score <= 3) level = 'simple';
    else if (score <= 6) level = 'medium';
    else if (score <= 8) level = 'complex';
    else level = 'expert';

    return {
      overall: level,
      score,
      reasoning: `Complexity assessed based on task content analysis (score: ${score})`,
      factors: [
        {
          name: 'Text Analysis',
          impact: score > 6 ? 'high' : score > 3 ? 'medium' : 'low',
          weight: 1.0,
          description: 'Complexity inferred from task description'
        }
      ]
    };
  }

  /**
   * Find matching agents based on analysis
   */
  private async findMatchingAgents(
    analysis: ExpertiseAnalysis, 
    input: ExpertiseIdentificationInput
  ): Promise<AgentSpecification[]> {
    const criteria = {
      requiredCapabilities: analysis.requiredCapabilities.map(c => c.id),
      domains: analysis.domains,
      minConfidence: input.options?.minConfidence || 0.5,
      maxMatches: input.options?.maxAgents || 5
    };

    const matches = await this.matchingEngine.findMatches(criteria);
    return matches.map(match => match.specification);
  }

  /**
   * Calculate overall confidence in recommendations
   */
  private calculateOverallConfidence(
    specifications: AgentSpecification[], 
    analysis: ExpertiseAnalysis
  ): number {
    if (specifications.length === 0) return 0;

    const avgConfidence = specifications.reduce((sum, spec) => sum + spec.confidence, 0) / specifications.length;
    const complexityPenalty = analysis.complexity.score > 7 ? 0.1 : 0;
    const domainBonus = analysis.domains.length > 0 ? 0.1 : 0;

    return Math.max(0, Math.min(1, avgConfidence - complexityPenalty + domainBonus));
  }

  /**
   * Apply fallback strategies if needed
   */
  private async applyFallbackStrategies(
    specifications: AgentSpecification[],
    analysis: ExpertiseAnalysis,
    input: ExpertiseIdentificationInput,
    confidence: number
  ): Promise<AgentSpecification[]> {
    
    // Check if we need to apply fallback strategies
    for (const strategy of this.config.fallbackStrategies) {
      let shouldApply = false;

      switch (strategy.trigger) {
        case 'no-matches':
          shouldApply = specifications.length === 0;
          break;
        case 'low-confidence':
          shouldApply = confidence < (input.options?.minConfidence || 0.5);
          break;
        case 'timeout':
          // Would be handled by timeout mechanism
          break;
        case 'error':
          // Would be handled in catch blocks
          break;
      }

      if (shouldApply) {
        this.emit('fallback-triggered', { strategy, reason: `Triggered by ${strategy.trigger}` });
        return this.executeFallbackStrategy(strategy, specifications, analysis, input);
      }
    }

    return specifications;
  }

  /**
   * Execute a specific fallback strategy
   */
  private async executeFallbackStrategy(
    strategy: FallbackStrategy,
    specifications: AgentSpecification[],
    analysis: ExpertiseAnalysis,
    input: ExpertiseIdentificationInput
  ): Promise<AgentSpecification[]> {
    
    switch (strategy.action) {
      case 'broaden-criteria':
        // Relax matching criteria and try again
        const relaxedCriteria = {
          requiredCapabilities: analysis.requiredCapabilities.slice(0, 2).map(c => c.id),
          domains: analysis.domains,
          minConfidence: 0.3,
          maxMatches: input.options?.maxAgents || 5
        };
        const relaxedMatches = await this.matchingEngine.findMatches(relaxedCriteria);
        return relaxedMatches.map(match => match.specification);

      case 'suggest-alternatives':
        // Return alternative domain suggestions
        return this.getAlternativeAgents(analysis);

      case 'default-agent':
        // Return a general-purpose agent
        return this.getDefaultAgent();

      case 'request-human':
        // Return empty array to indicate human intervention needed
        return [];

      default:
        return specifications;
    }
  }

  /**
   * Get alternative agents from related domains
   */
  private getAlternativeAgents(analysis: ExpertiseAnalysis): AgentSpecification[] {
    // Get agents from related domains
    const allSpecs = this.registry.getAll();
    const alternatives = allSpecs.filter(spec => 
      spec.domain !== analysis.domains[0] && 
      spec.confidence > 0.3
    );

    return alternatives.slice(0, 3);
  }

  /**
   * Get default general-purpose agent
   */
  private getDefaultAgent(): AgentSpecification[] {
    const defaultSpec: AgentSpecification = {
      id: 'general-agent',
      domain: 'general',
      role: 'General Assistant',
      capabilities: [
        {
          id: 'general-assistance',
          name: 'General Assistance',
          category: 'problem-solving',
          level: 'intermediate',
          importance: 'medium',
          keywords: ['help', 'assist', 'general'],
          description: 'General problem-solving and assistance'
        }
      ],
      personalityTraits: [
        {
          name: 'helpful',
          strength: 0.8,
          description: 'Eager to help and provide assistance',
          category: 'social'
        }
      ],
      tools: [],
      confidence: 0.5,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: ['default', 'general'],
        author: 'system'
      }
    };

    return [defaultSpec];
  }

  /**
   * Generate reasoning for recommendations
   */
  private generateReasoning(specifications: AgentSpecification[], analysis: ExpertiseAnalysis): string {
    if (specifications.length === 0) {
      return 'No suitable agents found for the given requirements. Consider broadening the criteria or requesting human assistance.';
    }

    const reasons = [
      `Found ${specifications.length} suitable agent(s) for the task.`,
      `Primary domains identified: ${analysis.domains.join(', ')}.`,
      `Complexity level: ${analysis.complexity.overall}.`
    ];

    if (specifications[0]) {
      reasons.push(`Top recommendation: ${specifications[0].role} with ${Math.round(specifications[0].confidence * 100)}% confidence.`);
    }

    return reasons.join(' ');
  }

  /**
   * Generate cache key for input
   */
  private generateCacheKey(input: ExpertiseIdentificationInput): string {
    const keyData = {
      task: input.task,
      context: input.context,
      options: input.options
    };
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<ExpertiseIdentificationConfig>): ExpertiseIdentificationConfig {
    return {
      timeout: config.timeout || 30000,
      enableCaching: config.enableCaching ?? true,
      cacheTimeout: config.cacheTimeout || 300000,
      useAI: config.useAI ?? true,
      aiConfig: config.aiConfig,
      defaultWeights: config.defaultWeights || {
        capabilities: 0.4,
        domain: 0.3,
        experience: 0.15,
        personality: 0.1,
        tools: 0.05
      },
      fallbackStrategies: config.fallbackStrategies || [
        {
          name: 'broaden-criteria',
          trigger: 'no-matches',
          action: 'broaden-criteria'
        },
        {
          name: 'low-confidence-fallback',
          trigger: 'low-confidence',
          action: 'suggest-alternatives'
        }
      ]
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get system metrics
   */
  getMetrics() {
    return {
      cacheSize: this.cache.size,
      registrySize: this.registry.getAll().length,
      lastProcessingTime: 0 // Would track actual processing times
    };
  }
}

// Type the EventEmitter properly
export interface ExpertiseIdentificationSystem {
  on<K extends keyof ExpertiseIdentificationEvents>(
    event: K, 
    listener: (data: ExpertiseIdentificationEvents[K]) => void
  ): this;
  
  emit<K extends keyof ExpertiseIdentificationEvents>(
    event: K, 
    data: ExpertiseIdentificationEvents[K]
  ): boolean;
}