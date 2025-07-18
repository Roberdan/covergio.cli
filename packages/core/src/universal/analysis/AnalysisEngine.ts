/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextEngine } from '../context/ContextEngine';
import { DomainRegistry } from '../domain/DomainRegistry';

interface TaskAnalysis {
  requiredDomains: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedEffort: number;
  dependencies: string[];
  requiredCapabilities: string[];
  confidence: number;
  metadata: {
    keywords: string[];
    entities: Record<string, string[]>;
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
}

interface DomainMatch {
  domainId: string;
  score: number;
  matchedKeywords: string[];
  matchedEntities: string[];
}

export class AnalysisEngine {
  private contextEngine: ContextEngine;
  private domainRegistry: DomainRegistry;
  
  // Domain-specific keywords and patterns
  private domainKeywords: Record<string, string[]> = {
    'code': ['code', 'program', 'function', 'class', 'method', 'variable', 'bug', 'error', 'fix', 'implement'],
    'documentation': ['document', 'doc', 'guide', 'explain', 'describe', 'tutorial', 'how to'],
    'testing': ['test', 'unit', 'integration', 'coverage', 'assert', 'mock', 'stub'],
    'security': ['security', 'vulnerability', 'auth', 'authentication', 'authorization', 'encrypt', 'decrypt'],
    'performance': ['performance', 'optimize', 'speed', 'fast', 'slow', 'bottleneck', 'memory', 'cpu'],
    'deployment': ['deploy', 'build', 'release', 'publish', 'container', 'docker', 'kubernetes'],
    'data': ['database', 'query', 'schema', 'migrate', 'model', 'table', 'index'],
    'api': ['api', 'endpoint', 'rest', 'graphql', 'request', 'response', 'http'],
    'ui': ['ui', 'ux', 'interface', 'user interface', 'component', 'button', 'form', 'layout'],
    'ai': ['ai', 'ml', 'machine learning', 'model', 'training', 'inference', 'llm', 'prompt']
  };

  constructor(contextEngine?: ContextEngine, domainRegistry?: DomainRegistry) {
    this.contextEngine = contextEngine || ContextEngine.getInstance();
    this.domainRegistry = domainRegistry || DomainRegistry.getInstance();
  }

  async analyzeTask(taskDescription: string, contextId?: string): Promise<TaskAnalysis> {
    // 1. Extract keywords and entities
    const { keywords, entities } = await this.extractKeywordsAndEntities(taskDescription);
    
    // 2. Detect required domains
    const domainMatches = await this.detectDomains(keywords, entities);
    const requiredDomains = domainMatches
      .filter(match => match.score > 0.3) // Threshold for considering a domain relevant
      .sort((a, b) => b.score - a.score)
      .map(match => match.domainId);
    
    // 3. Assess complexity
    const complexity = this.assessComplexity(taskDescription, domainMatches);
    
    // 4. Identify required capabilities
    const requiredCapabilities = this.identifyRequiredCapabilities(domainMatches);
    
    // 5. Calculate confidence
    const confidence = this.calculateConfidence(domainMatches);
    
    // 6. Estimate effort
    const estimatedEffort = this.estimateEffort(complexity, domainMatches.length);
    
    // 7. Save analysis context if contextId is provided
    if (contextId) {
      await this.saveAnalysisContext(contextId, {
        taskDescription,
        analysis: {
          requiredDomains,
          complexity,
          requiredCapabilities,
          confidence,
          estimatedEffort,
          keywords,
          entities
        }
      });
    }
    
    return {
      requiredDomains,
      complexity,
      estimatedEffort,
      dependencies: [], // Would be populated based on task relationships
      requiredCapabilities,
      confidence,
      metadata: {
        keywords,
        entities,
        sentiment: this.analyzeSentiment(taskDescription)
      }
    };
  }

  async detectDomains(
    keywords: string[],
    entities: Record<string, string[]>
  ): Promise<DomainMatch[]> {
    const domainScores: Record<string, DomainMatch> = {};
    
    // Initialize domain scores
    for (const domainId of Object.keys(this.domainKeywords)) {
      domainScores[domainId] = {
        domainId,
        score: 0,
        matchedKeywords: [],
        matchedEntities: []
      };
    }
    
    // Score based on keyword matches
    for (const [domainId, domainKeywords] of Object.entries(this.domainKeywords)) {
      for (const keyword of keywords) {
        if (domainKeywords.some(kw => keyword.toLowerCase().includes(kw))) {
          domainScores[domainId].score += 1;
          domainScores[domainId].matchedKeywords.push(keyword);
        }
      }
    }
    
    // Score based on entity matches
    for (const [entityType, entityValues] of Object.entries(entities)) {
      for (const entity of entityValues) {
        // Simple matching - in a real implementation, this would use NLP
        for (const [domainId, domainKeywords] of Object.entries(this.domainKeywords)) {
          if (domainKeywords.some(kw => entity.toLowerCase().includes(kw))) {
            domainScores[domainId].score += 2; // Entities are weighted more heavily
            domainScores[domainId].matchedEntities.push(`${entityType}:${entity}`);
          }
        }
      }
    }
    
    // Normalize scores
    const maxScore = Math.max(...Object.values(domainScores).map(d => d.score));
    if (maxScore > 0) {
      for (const domainId in domainScores) {
        domainScores[domainId].score /= maxScore;
      }
    }
    
    return Object.values(domainScores);
  }

  private extractKeywordsAndEntities(text: string): { keywords: string[]; entities: Record<string, string[]> } {
    // In a real implementation, this would use NLP to extract keywords and entities
    // For now, we'll use a simplified approach
    
    // Simple tokenization and cleaning
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w-]/g, ''))
      .filter(word => word.length > 2); // Filter out short words
    
    // Count word frequencies
    const wordCounts: Record<string, number> = {};
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
    
    // Get top keywords (simple heuristic)
    const keywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 keywords
      .map(([word]) => word);
    
    // Simple entity extraction (in a real implementation, use NLP)
    const entities: Record<string, string[]> = {
      technologies: this.extractTechnologies(text),
      languages: this.extractLanguages(text),
      frameworks: this.extractFrameworks(text)
    };
    
    return { keywords, entities };
  }
  
  private extractTechnologies(text: string): string[] {
    // In a real implementation, this would use a more sophisticated approach
    const techKeywords = ['react', 'node', 'python', 'typescript', 'docker', 'kubernetes', 'aws', 'azure', 'gcp'];
    return techKeywords.filter(tech => 
      new RegExp(`\\b${tech}\\b`, 'i').test(text)
    );
  }
  
  private extractLanguages(text: string): string[] {
    const languages = ['javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'go', 'rust', 'ruby', 'php'];
    return languages.filter(lang => 
      new RegExp(`\\b${lang}\\b`, 'i').test(text)
    );
  }
  
  private extractFrameworks(text: string): string[] {
    const frameworks = ['react', 'angular', 'vue', 'express', 'django', 'flask', 'spring', 'laravel', 'rails'];
    return frameworks.filter(framework => 
      new RegExp(`\\b${framework}\\b`, 'i').test(text)
    );
  }

  private assessComplexity(
    description: string,
    domainMatches: DomainMatch[]
  ): 'low' | 'medium' | 'high' {
    // Simple heuristic based on description length and domain matches
    const wordCount = description.split(/\s+/).length;
    const domainCount = domainMatches.filter(m => m.score > 0.3).length;
    
    let complexityScore = 0;
    
    // Word count contributes to complexity
    if (wordCount > 100) complexityScore += 2;
    else if (wordCount > 50) complexityScore += 1;
    
    // Number of domains contributes to complexity
    if (domainCount > 3) complexityScore += 2;
    else if (domainCount > 1) complexityScore += 1;
    
    // High-confidence domain matches can adjust complexity
    const highConfidenceDomains = domainMatches.filter(m => m.score > 0.7).length;
    complexityScore += Math.min(highConfidenceDomains, 2);
    
    // Determine complexity level
    if (complexityScore >= 3) return 'high';
    if (complexityScore >= 1) return 'medium';
    return 'low';
  }
  
  private identifyRequiredCapabilities(domainMatches: DomainMatch[]): string[] {
    const capabilities: Set<string> = new Set();
    
    for (const match of domainMatches) {
      if (match.score > 0.3) { // Only consider relevant domains
        // Map domains to capabilities (simplified)
        switch (match.domainId) {
          case 'code':
            capabilities.add('code-generation');
            capabilities.add('code-analysis');
            break;
          case 'testing':
            capabilities.add('test-generation');
            capabilities.add('test-execution');
            break;
          case 'documentation':
            capabilities.add('documentation-generation');
            break;
          case 'security':
            capabilities.add('security-analysis');
            break;
          case 'performance':
            capabilities.add('performance-analysis');
            break;
          case 'deployment':
            capabilities.add('deployment');
            break;
          case 'ai':
            capabilities.add('ai-model-interaction');
            break;
        }
      }
    }
    
    return Array.from(capabilities);
  }
  
  private calculateConfidence(domainMatches: DomainMatch[]): number {
    // Calculate confidence based on domain match scores
    if (domainMatches.length === 0) return 0;
    
    const relevantMatches = domainMatches.filter(m => m.score > 0.3);
    if (relevantMatches.length === 0) return 0;
    
    // Average score of relevant domains, weighted by number of matches
    const totalScore = relevantMatches.reduce((sum, match) => sum + match.score, 0);
    const avgScore = totalScore / relevantMatches.length;
    
    // More matches increase confidence (up to a point)
    const matchCountFactor = Math.min(relevantMatches.length / 3, 1);
    
    return (avgScore * 0.7) + (matchCountFactor * 0.3);
  }
  
  private estimateEffort(
    complexity: 'low' | 'medium' | 'high',
    domainCount: number
  ): number {
    // Simple effort estimation (in story points)
    const complexityFactors = {
      low: 1,
      medium: 3,
      high: 8
    };
    
    // More domains mean more coordination effort
    const domainFactor = 1 + (domainCount * 0.5);
    
    return Math.ceil(complexityFactors[complexity] * domainFactor);
  }
  
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    // In a real implementation, this would use an NLP sentiment analysis library
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'problem', 'issue', 'error'];
    
    const words = text.toLowerCase().split(/\s+/);
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of words) {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    }
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
  
  private async saveAnalysisContext(
    contextId: string, 
    data: any
  ): Promise<void> {
    try {
      await this.contextEngine.updateContext(contextId, {
        data: {
          ...data,
          analyzedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to save analysis context:', error);
    }
  }
  
  // Singleton pattern
  private static instance: AnalysisEngine;
  
  public static getInstance(contextEngine?: ContextEngine, domainRegistry?: DomainRegistry): AnalysisEngine {
    if (!AnalysisEngine.instance) {
      AnalysisEngine.instance = new AnalysisEngine(contextEngine, domainRegistry);
    }
    return AnalysisEngine.instance;
  }
  
  public static resetInstance(): void {
    AnalysisEngine.instance = new AnalysisEngine();
  }
}
