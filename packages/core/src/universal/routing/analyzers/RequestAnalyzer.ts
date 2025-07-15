/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IRequestAnalyzer, RequestAnalysis } from '../../interfaces/IRequestHandler.js';
import { OrchestrationRequest } from '../../interfaces/IOrchestrator.js';

export class RequestAnalyzer implements IRequestAnalyzer {
  private complexityPatterns = {
    simple: [
      /^(hi|hello|help|what|how|when|where|who|why)\b/i,
      /^(can you|could you|please)\s+\w+\s*\?*$/i,
      /^\w+\s*\?*$/i,
    ],
    medium: [
      /\b(create|build|implement|generate|write)\b/i,
      /\b(analyze|review|check|validate|test)\b/i,
      /\b(explain|describe|document|summarize)\b/i,
    ],
    complex: [
      /\b(design|architect|refactor|optimize|migrate)\b/i,
      /\b(integrate|coordinate|orchestrate)\b/i,
      /\b(multiple|several|various|different)\b.*\b(steps|phases|parts|components)\b/i,
      /\band\b.*\band\b.*\band\b/i, // Multiple "and" suggests complexity
    ],
  };

  private domainPatterns = {
    'code-generation': [
      /\b(code|programming|script|function|class|method)\b/i,
      /\b(typescript|javascript|python|react|node)\b/i,
      /\b(api|endpoint|component|service)\b/i,
    ],
    'documentation': [
      /\b(document|readme|guide|tutorial|explanation)\b/i,
      /\b(write|create|update).*\b(docs|documentation)\b/i,
    ],
    'testing': [
      /\b(test|testing|unit|integration|e2e)\b/i,
      /\b(spec|specs|jest|vitest|cypress)\b/i,
    ],
    'data-analysis': [
      /\b(analyze|data|metrics|statistics|report)\b/i,
      /\b(database|sql|query|table)\b/i,
    ],
    'project-management': [
      /\b(task|project|plan|schedule|organize)\b/i,
      /\b(workflow|process|milestone|deadline)\b/i,
    ],
    'infrastructure': [
      /\b(deploy|deployment|infrastructure|docker|kubernetes)\b/i,
      /\b(server|hosting|cloud|aws|azure|gcp)\b/i,
    ],
  };

  private capabilityMapping = {
    'code-generation': ['text-generation', 'code-assistance'],
    'documentation': ['text-generation', 'content-creation'],
    'testing': ['code-assistance', 'quality-assurance'],
    'data-analysis': ['data-processing', 'analysis'],
    'project-management': ['task-analysis', 'project-management'],
    'infrastructure': ['system-administration', 'deployment'],
  };

  async analyze(request: OrchestrationRequest): Promise<RequestAnalysis> {
    const normalizedInput = this.normalizeInput(request.userInput);
    const complexity = this.analyzeComplexity(normalizedInput);
    const intent = this.extractIntent(normalizedInput);
    const domains = this.identifyDomains(normalizedInput);
    const requiredCapabilities = this.determineCapabilities(domains);
    const estimatedDuration = this.estimateDuration(complexity, domains.length);
    const priority = this.determinePriority(request, complexity);

    return {
      complexity,
      intent,
      domains,
      requiredCapabilities,
      estimatedDuration,
      priority,
      metadata: {
        originalInput: request.userInput,
        normalizedInput,
        wordCount: normalizedInput.split(/\s+/).length,
        hasQuestions: /\?/.test(normalizedInput),
        hasCommands: /\b(please|can you|could you|would you)\b/i.test(normalizedInput),
        timestamp: new Date().toISOString(),
      },
    };
  }

  async canHandle(request: OrchestrationRequest): Promise<boolean> {
    if (!request.userInput || request.userInput.trim().length === 0) {
      return false;
    }

    const normalizedInput = this.normalizeInput(request.userInput);
    
    // Check for obvious spam or inappropriate content
    if (this.isSpamOrInappropriate(normalizedInput)) {
      return false;
    }

    // Must have some recognizable intent
    return normalizedInput.length >= 3 && /[a-zA-Z]/.test(normalizedInput);
  }

  private normalizeInput(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\w\s?]/g, ' ') // Remove special chars except ?
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private analyzeComplexity(input: string): 'simple' | 'medium' | 'complex' {
    for (const pattern of this.complexityPatterns.complex) {
      if (pattern.test(input)) {
        return 'complex';
      }
    }

    for (const pattern of this.complexityPatterns.medium) {
      if (pattern.test(input)) {
        return 'medium';
      }
    }

    return 'simple';
  }

  private extractIntent(input: string): string {
    // Extract primary action verb
    const actionMatch = input.match(/\b(create|build|implement|generate|write|analyze|review|check|validate|test|explain|describe|document|summarize|design|architect|refactor|optimize|migrate|integrate|coordinate|orchestrate|help|show|find|get|list|update|delete|remove)\b/i);
    
    if (actionMatch) {
      const action = actionMatch[1].toLowerCase();
      const target = input.replace(new RegExp(`\\b${action}\\b`, 'i'), '').trim();
      return `${action} ${target}`.trim();
    }

    // Fallback to first few words
    const words = input.split(/\s+/).slice(0, 5);
    return words.join(' ');
  }

  private identifyDomains(input: string): string[] {
    const domains: string[] = [];

    for (const [domain, patterns] of Object.entries(this.domainPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          domains.push(domain);
          break;
        }
      }
    }

    return domains.length > 0 ? domains : ['general'];
  }

  private determineCapabilities(domains: string[]): string[] {
    const capabilities = new Set<string>();

    for (const domain of domains) {
      const domainCapabilities = this.capabilityMapping[domain as keyof typeof this.capabilityMapping];
      if (domainCapabilities) {
        domainCapabilities.forEach(cap => capabilities.add(cap));
      }
    }

    // Default capabilities for general requests
    if (capabilities.size === 0) {
      capabilities.add('text-generation');
      capabilities.add('general-assistance');
    }

    return Array.from(capabilities);
  }

  private estimateDuration(complexity: string, domainCount: number): number {
    const baseTimeMs = {
      simple: 2000,   // 2 seconds
      medium: 10000,  // 10 seconds
      complex: 30000, // 30 seconds
    };

    const base = baseTimeMs[complexity as keyof typeof baseTimeMs] || 5000;
    const domainMultiplier = Math.max(1, domainCount * 0.5);
    
    return Math.round(base * domainMultiplier);
  }

  private determinePriority(
    request: OrchestrationRequest, 
    complexity: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Use request priority if specified
    if (request.priority) {
      return request.priority;
    }

    // Determine based on complexity and urgency indicators
    const urgentKeywords = /\b(urgent|asap|immediately|now|critical|emergency)\b/i;
    const lowPriorityKeywords = /\b(later|eventually|when you can|no rush)\b/i;

    if (urgentKeywords.test(request.userInput)) {
      return complexity === 'complex' ? 'critical' : 'high';
    }

    if (lowPriorityKeywords.test(request.userInput)) {
      return 'low';
    }

    // Default mapping
    const priorityMap = {
      simple: 'medium' as const,
      medium: 'medium' as const,
      complex: 'high' as const,
    };

    return priorityMap[complexity as keyof typeof priorityMap] || 'medium';
  }

  private isSpamOrInappropriate(input: string): boolean {
    const spamPatterns = [
      /^(.)\1{10,}$/, // Repeated characters
      /[^\w\s]{5,}/, // Too many special characters
      /\b(spam|scam|phishing|malware|virus)\b/i,
    ];

    return spamPatterns.some(pattern => pattern.test(input));
  }
}