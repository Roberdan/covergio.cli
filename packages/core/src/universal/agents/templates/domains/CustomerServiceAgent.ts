/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent } from '../../BaseAgent.js';
import { 
  AgentConfig, 
  AgentRequest, 
  AgentResponse, 
  PersonalityTrait 
} from '../../types.js';
import { DomainAgentTemplate } from '../AgentTemplateSystem.js';

/**
 * Customer service specific request types
 */
export interface CustomerServiceRequest extends AgentRequest {
  customerInfo?: {
    id: string;
    name: string;
    tier: 'basic' | 'premium' | 'enterprise';
    history: string[];
  };
  issueType: 'technical' | 'billing' | 'general' | 'complaint' | 'feature_request';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sentiment?: 'positive' | 'neutral' | 'negative' | 'angry';
}

/**
 * Customer service response types
 */
export interface CustomerServiceResponse extends AgentResponse {
  resolutionStatus: 'resolved' | 'escalated' | 'pending' | 'follow_up_needed';
  nextActions: string[];
  customerSatisfactionScore?: number;
  escalationReason?: string;
}

/**
 * Specialized customer service agent implementation
 */
export class CustomerServiceAgent extends BaseAgent {
  private knowledgeBase: Map<string, string> = new Map();
  private escalationRules: EscalationRule[] = [];
  private responseTemplates: Map<string, string> = new Map();

  constructor(config: AgentConfig) {
    super(config);
    this.initializeKnowledgeBase();
    this.initializeEscalationRules();
    this.initializeResponseTemplates();
  }

  /**
   * Execute customer service task
   */
  protected async executeTask(request: AgentRequest): Promise<AgentResponse> {
    const csRequest = request as CustomerServiceRequest;
    
    // Analyze customer sentiment and issue
    const analysis = await this.analyzeCustomerIssue(csRequest);
    
    // Determine response strategy
    const strategy = this.determineResponseStrategy(analysis);
    
    // Generate appropriate response
    const response = await this.generateCustomerResponse(csRequest, strategy);
    
    // Check for escalation needs
    const escalationCheck = this.checkEscalationNeeds(csRequest, analysis);
    
    return {
      ...response,
      context: request.context || {
        sessionId: '',
        executionId: '',
        timestamp: new Date(),
        environment: { name: 'production' }
      }
    } as CustomerServiceResponse;
  }

  /**
   * Analyze customer issue and sentiment
   */
  private async analyzeCustomerIssue(request: CustomerServiceRequest): Promise<IssueAnalysis> {
    const urgencyKeywords = ['urgent', 'emergency', 'immediately', 'asap', 'critical'];
    const negativeKeywords = ['angry', 'frustrated', 'disappointed', 'terrible', 'awful'];
    const technicalKeywords = ['bug', 'error', 'crash', 'not working', 'broken'];

    const text = request.input.toLowerCase();
    
    return {
      urgency: urgencyKeywords.some(keyword => text.includes(keyword)) ? 'high' : 
               request.priority === 'urgent' ? 'high' : 'normal',
      sentiment: request.sentiment || this.detectSentiment(text),
      complexity: this.assessComplexity(request),
      category: request.issueType,
      keywords: this.extractKeywords(text),
      customerTier: request.customerInfo?.tier || 'basic'
    };
  }

  /**
   * Determine response strategy based on analysis
   */
  private determineResponseStrategy(analysis: IssueAnalysis): ResponseStrategy {
    let strategy: ResponseStrategy = {
      tone: 'professional',
      approach: 'standard',
      templateType: 'general',
      escalate: false,
      followUpRequired: false
    };

    // Adjust tone based on sentiment
    switch (analysis.sentiment) {
      case 'angry':
        strategy.tone = 'empathetic';
        strategy.approach = 'de-escalation';
        break;
      case 'negative':
        strategy.tone = 'understanding';
        strategy.approach = 'problem-solving';
        break;
      case 'positive':
        strategy.tone = 'friendly';
        strategy.approach = 'supportive';
        break;
    }

    // Adjust for urgency
    if (analysis.urgency === 'high') {
      strategy.approach = 'urgent';
      strategy.followUpRequired = true;
    }

    // Adjust for customer tier
    if (analysis.customerTier === 'enterprise') {
      strategy.tone = 'formal';
      strategy.approach = 'priority';
    }

    // Check escalation needs
    strategy.escalate = this.shouldEscalate(analysis);

    return strategy;
  }

  /**
   * Generate customer service response
   */
  private async generateCustomerResponse(
    request: CustomerServiceRequest, 
    strategy: ResponseStrategy
  ): Promise<CustomerServiceResponse> {
    let content = '';
    let resolutionStatus: CustomerServiceResponse['resolutionStatus'] = 'pending';
    const nextActions: string[] = [];

    // Start with appropriate greeting
    content += this.getGreeting(strategy.tone, request.customerInfo?.name);

    // Acknowledge the issue
    content += this.acknowledgeIssue(request, strategy);

    // Provide solution or next steps
    const solution = await this.findSolution(request);
    if (solution) {
      content += solution;
      resolutionStatus = 'resolved';
      nextActions.push('Mark issue as resolved');
      nextActions.push('Send follow-up survey');
    } else {
      content += this.getInvestigationResponse(strategy);
      resolutionStatus = 'pending';
      nextActions.push('Research issue further');
      nextActions.push('Follow up within 24 hours');
    }

    // Handle escalation
    if (strategy.escalate) {
      content += this.getEscalationMessage(strategy.tone);
      resolutionStatus = 'escalated';
      nextActions.push('Transfer to specialist');
    }

    // Add closing
    content += this.getClosing(strategy.tone);

    return {
      type: 'text',
      content,
      resolutionStatus,
      nextActions,
      customerSatisfactionScore: this.predictSatisfactionScore(strategy, resolutionStatus),
      escalationReason: strategy.escalate ? 'Complex technical issue requiring specialist' : undefined
    };
  }

  /**
   * Check if issue needs escalation
   */
  private checkEscalationNeeds(request: CustomerServiceRequest, analysis: IssueAnalysis): boolean {
    return this.escalationRules.some(rule => this.matchesEscalationRule(rule, request, analysis));
  }

  /**
   * Find solution in knowledge base
   */
  private async findSolution(request: CustomerServiceRequest): Promise<string | null> {
    const keywords = this.extractKeywords(request.input.toLowerCase());
    
    for (const keyword of keywords) {
      const solution = this.knowledgeBase.get(keyword);
      if (solution) {
        return `Based on your issue, here's what I recommend:\n\n${solution}\n\n`;
      }
    }

    // Check for common issues
    const commonIssues = this.getCommonIssuesForType(request.issueType);
    for (const issue of commonIssues) {
      if (request.input.toLowerCase().includes(issue.keyword)) {
        return `I can help with that! ${issue.solution}\n\n`;
      }
    }

    return null;
  }

  /**
   * Detect sentiment from text
   */
  private detectSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'angry' {
    const angryWords = ['furious', 'outrageous', 'unacceptable', 'ridiculous'];
    const negativeWords = ['bad', 'poor', 'disappointing', 'frustrated', 'unhappy'];
    const positiveWords = ['good', 'great', 'excellent', 'satisfied', 'happy', 'love'];

    if (angryWords.some(word => text.includes(word))) return 'angry';
    if (negativeWords.some(word => text.includes(word))) return 'negative';
    if (positiveWords.some(word => text.includes(word))) return 'positive';
    
    return 'neutral';
  }

  /**
   * Assess issue complexity
   */
  private assessComplexity(request: CustomerServiceRequest): 'low' | 'medium' | 'high' {
    const technicalTerms = ['api', 'database', 'server', 'integration', 'ssl', 'oauth'];
    const complexityIndicators = ['multiple', 'several', 'various', 'complex', 'advanced'];
    
    const text = request.input.toLowerCase();
    
    if (technicalTerms.some(term => text.includes(term))) return 'high';
    if (complexityIndicators.some(indicator => text.includes(indicator))) return 'medium';
    
    return 'low';
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = text.toLowerCase().split(/\s+/).filter(word => 
      word.length > 2 && !stopWords.includes(word)
    );
    
    return [...new Set(words)].slice(0, 10); // Top 10 unique keywords
  }

  /**
   * Check if escalation rule matches
   */
  private matchesEscalationRule(rule: EscalationRule, request: CustomerServiceRequest, analysis: IssueAnalysis): boolean {
    if (rule.urgency && analysis.urgency !== rule.urgency) return false;
    if (rule.sentiment && analysis.sentiment !== rule.sentiment) return false;
    if (rule.complexity && analysis.complexity !== rule.complexity) return false;
    if (rule.customerTier && analysis.customerTier !== rule.customerTier) return false;
    if (rule.issueType && request.issueType !== rule.issueType) return false;
    
    return true;
  }

  /**
   * Should escalate based on analysis
   */
  private shouldEscalate(analysis: IssueAnalysis): boolean {
    return (
      analysis.urgency === 'high' && analysis.complexity === 'high'
    ) || (
      analysis.sentiment === 'angry' && analysis.customerTier === 'enterprise'
    ) || (
      analysis.complexity === 'high' && analysis.category === 'technical'
    );
  }

  /**
   * Get appropriate greeting
   */
  private getGreeting(tone: string, customerName?: string): string {
    const name = customerName ? ` ${customerName}` : '';
    
    switch (tone) {
      case 'empathetic':
        return `Hi${name}, I understand you're having an issue and I'm here to help resolve it as quickly as possible.\n\n`;
      case 'formal':
        return `Dear${name}, thank you for contacting our support team. I will be assisting you today.\n\n`;
      case 'friendly':
        return `Hello${name}! Thanks for reaching out. I'm happy to help you with your question.\n\n`;
      default:
        return `Hi${name}, I'm here to help you with your inquiry.\n\n`;
    }
  }

  /**
   * Acknowledge the issue
   */
  private acknowledgeIssue(request: CustomerServiceRequest, strategy: ResponseStrategy): string {
    switch (strategy.approach) {
      case 'de-escalation':
        return `I sincerely apologize for the inconvenience you're experiencing. Your frustration is completely understandable, and I'm committed to finding a solution for you.\n\n`;
      case 'urgent':
        return `I understand this is urgent for you. Let me prioritize this and work on getting you a quick resolution.\n\n`;
      case 'priority':
        return `As a valued enterprise customer, your issue is my top priority. I'll ensure we resolve this promptly.\n\n`;
      default:
        return `I've reviewed your inquiry and I'm ready to help you resolve this issue.\n\n`;
    }
  }

  /**
   * Get investigation response
   */
  private getInvestigationResponse(strategy: ResponseStrategy): string {
    if (strategy.escalate) {
      return `This appears to be a complex issue that requires specialist attention. I'm going to connect you with our technical expert who can provide more detailed assistance.\n\n`;
    }
    
    return `I need to investigate this further to provide you with the best solution. I'll research this issue and get back to you within 24 hours with a detailed response.\n\n`;
  }

  /**
   * Get escalation message
   */
  private getEscalationMessage(tone: string): string {
    switch (tone) {
      case 'formal':
        return `I am escalating your case to our specialized technical team who will be able to provide expert assistance.\n\n`;
      case 'empathetic':
        return `To ensure you get the best possible help, I'm connecting you with one of our specialists who can resolve this issue quickly.\n\n`;
      default:
        return `I'm transferring you to a specialist who can better assist with this type of issue.\n\n`;
    }
  }

  /**
   * Get appropriate closing
   */
  private getClosing(tone: string): string {
    switch (tone) {
      case 'formal':
        return `Thank you for your patience. Please don't hesitate to contact us if you need any additional assistance.`;
      case 'friendly':
        return `Thanks for giving me the chance to help! Feel free to reach out anytime if you have more questions.`;
      case 'empathetic':
        return `I appreciate your patience as we work through this together. You can count on us to take care of you.`;
      default:
        return `Thank you for contacting support. I'm here if you need any further assistance.`;
    }
  }

  /**
   * Predict customer satisfaction score
   */
  private predictSatisfactionScore(strategy: ResponseStrategy, status: CustomerServiceResponse['resolutionStatus']): number {
    let score = 7; // Base score
    
    // Adjust for resolution status
    switch (status) {
      case 'resolved':
        score += 2;
        break;
      case 'escalated':
        score -= 1;
        break;
      case 'pending':
        score -= 0.5;
        break;
    }
    
    // Adjust for approach
    if (strategy.approach === 'de-escalation') score += 1;
    if (strategy.approach === 'urgent') score += 0.5;
    
    return Math.min(10, Math.max(1, score));
  }

  /**
   * Get common issues for issue type
   */
  private getCommonIssuesForType(issueType: string): Array<{ keyword: string; solution: string }> {
    const commonIssues = {
      technical: [
        { keyword: 'login', solution: 'Try clearing your browser cache and cookies, then attempt to log in again.' },
        { keyword: 'password', solution: 'You can reset your password using the "Forgot Password" link on the login page.' },
        { keyword: 'slow', solution: 'This might be a temporary performance issue. Try refreshing the page or clearing your browser cache.' }
      ],
      billing: [
        { keyword: 'charge', solution: 'I can help you review your billing details. Let me check your account for any recent charges.' },
        { keyword: 'refund', solution: 'I understand you\'re looking for a refund. Let me review your account and our refund policy.' }
      ],
      general: [
        { keyword: 'how to', solution: 'I\'d be happy to walk you through the process step by step.' },
        { keyword: 'feature', solution: 'Let me explain how this feature works and how you can use it effectively.' }
      ]
    };
    
    return commonIssues[issueType as keyof typeof commonIssues] || [];
  }

  /**
   * Initialize knowledge base
   */
  private initializeKnowledgeBase(): void {
    this.knowledgeBase.set('login', 'For login issues, try: 1) Clear browser cache, 2) Check email/password, 3) Try incognito mode, 4) Contact support if issues persist.');
    this.knowledgeBase.set('billing', 'For billing questions: 1) Check your account dashboard, 2) Review recent transactions, 3) Contact billing team for detailed explanations.');
    this.knowledgeBase.set('feature', 'For feature requests: 1) Check our roadmap, 2) Submit feedback through our portal, 3) Consider workarounds for immediate needs.');
    this.knowledgeBase.set('bug', 'For bug reports: 1) Document steps to reproduce, 2) Note browser/device info, 3) Check if others report similar issues, 4) Submit to our bug tracker.');
  }

  /**
   * Initialize escalation rules
   */
  private initializeEscalationRules(): void {
    this.escalationRules = [
      { urgency: 'high', complexity: 'high', escalate: true },
      { sentiment: 'angry', customerTier: 'enterprise', escalate: true },
      { issueType: 'technical', complexity: 'high', escalate: true },
      { customerTier: 'enterprise', urgency: 'high', escalate: true }
    ];
  }

  /**
   * Initialize response templates
   */
  private initializeResponseTemplates(): void {
    this.responseTemplates.set('greeting_formal', 'Dear {customerName}, thank you for contacting our support team.');
    this.responseTemplates.set('greeting_friendly', 'Hi {customerName}! Thanks for reaching out.');
    this.responseTemplates.set('escalation', 'I\'m connecting you with a specialist who can better assist with this issue.');
    this.responseTemplates.set('resolution', 'I\'m pleased to let you know that I\'ve found a solution for your issue.');
  }
}

/**
 * Issue analysis result
 */
interface IssueAnalysis {
  urgency: 'low' | 'normal' | 'high';
  sentiment: 'positive' | 'neutral' | 'negative' | 'angry';
  complexity: 'low' | 'medium' | 'high';
  category: string;
  keywords: string[];
  customerTier: 'basic' | 'premium' | 'enterprise';
}

/**
 * Response strategy
 */
interface ResponseStrategy {
  tone: 'professional' | 'empathetic' | 'formal' | 'friendly' | 'understanding';
  approach: 'standard' | 'de-escalation' | 'problem-solving' | 'supportive' | 'urgent' | 'priority';
  templateType: string;
  escalate: boolean;
  followUpRequired: boolean;
}

/**
 * Escalation rule
 */
interface EscalationRule {
  urgency?: 'low' | 'normal' | 'high';
  sentiment?: 'positive' | 'neutral' | 'negative' | 'angry';
  complexity?: 'low' | 'medium' | 'high';
  customerTier?: 'basic' | 'premium' | 'enterprise';
  issueType?: string;
  escalate: boolean;
}

/**
 * Customer service agent template
 */
export const CustomerServiceTemplate: DomainAgentTemplate = {
  id: 'customer-service:support',
  domain: 'customer-service',
  role: 'support',
  description: 'Specialized agent for handling customer service inquiries with empathy and efficiency',
  defaultCapabilities: [
    'customer-communication',
    'issue-resolution',
    'empathy-response',
    'escalation-management',
    'knowledge-base-search'
  ],
  defaultPersonalityTraits: [
    { name: 'empathetic', value: 0.9, description: 'Highly empathetic to customer concerns', category: 'social' },
    { name: 'patient', value: 0.8, description: 'Patient with difficult customers', category: 'social' },
    { name: 'helpful', value: 0.9, description: 'Always willing to help', category: 'social' },
    { name: 'professional', value: 0.8, description: 'Maintains professional demeanor', category: 'communication' },
    { name: 'solution-oriented', value: 0.8, description: 'Focuses on finding solutions', category: 'problem-solving' }
  ],
  defaultTools: [
    'knowledge-base',
    'escalation-system',
    'customer-database',
    'ticket-system',
    'satisfaction-survey'
  ],
  configSchema: {
    type: 'object',
    properties: {
      escalationThreshold: { type: 'number', minimum: 1, maximum: 10 },
      responseTimeout: { type: 'number', minimum: 60, maximum: 3600 },
      enableSentimentAnalysis: { type: 'boolean' },
      customerTiers: { type: 'array', items: { type: 'string' } }
    }
  },
  examples: [
    'Help customer with login issues',
    'Resolve billing disputes',
    'Handle product complaints',
    'Process refund requests'
  ],
  documentation: 'Customer service agent specialized in handling customer inquiries with empathy and efficiency. Includes automatic escalation, sentiment analysis, and customer satisfaction prediction.',
  
  domainSpecific: {
    knowledgeBase: [
      'product-documentation',
      'troubleshooting-guides',
      'billing-procedures',
      'company-policies',
      'escalation-procedures'
    ],
    specializedTools: [
      'sentiment-analyzer',
      'auto-escalation',
      'customer-history',
      'satisfaction-predictor',
      'response-templates'
    ],
    communicationPatterns: [
      {
        name: 'empathetic-response',
        description: 'Empathetic response to frustrated customers',
        triggers: ['angry', 'frustrated', 'disappointed'],
        responseTemplate: 'I understand your frustration and I\'m here to help resolve this issue.',
        tone: 'friendly',
        context: ['customer-complaint', 'service-issue']
      },
      {
        name: 'solution-focused',
        description: 'Direct solution-oriented response',
        triggers: ['how-to', 'need-help', 'problem'],
        responseTemplate: 'Let me help you solve this step by step.',
        tone: 'professional',
        context: ['technical-support', 'guidance']
      }
    ],
    behaviorRules: [
      {
        name: 'auto-escalate-enterprise',
        description: 'Automatically escalate enterprise customer issues',
        condition: 'customer.tier === "enterprise" && issue.complexity === "high"',
        action: 'escalate_to_specialist',
        priority: 1,
        active: true
      },
      {
        name: 'sentiment-response',
        description: 'Adjust response tone based on customer sentiment',
        condition: 'sentiment === "angry"',
        action: 'use_empathetic_tone',
        priority: 2,
        active: true
      }
    ],
    validationRules: [
      {
        field: 'customerInfo.tier',
        rule: 'value && ["basic", "premium", "enterprise"].includes(value)',
        message: 'Customer tier must be basic, premium, or enterprise',
        severity: 'warning'
      }
    ]
  },
  
  inheritance: {
    baseTemplate: undefined,
    mixins: ['communication-mixin', 'empathy-mixin']
  },
  
  customization: {
    configurableFields: [
      {
        name: 'escalationThreshold',
        type: 'number',
        description: 'Threshold for automatic escalation (1-10)',
        defaultValue: 7,
        required: false,
        validation: { min: 1, max: 10 }
      },
      {
        name: 'enableSentimentAnalysis',
        type: 'boolean',
        description: 'Enable automatic sentiment analysis',
        defaultValue: true,
        required: false
      },
      {
        name: 'responseStyle',
        type: 'string',
        description: 'Default response style',
        defaultValue: 'professional',
        required: false,
        options: ['professional', 'friendly', 'formal', 'casual']
      }
    ],
    presets: [
      {
        name: 'enterprise-support',
        description: 'Optimized for enterprise customer support',
        configuration: {
          escalationThreshold: 5,
          responseStyle: 'formal',
          enableSentimentAnalysis: true
        },
        tags: ['enterprise', 'premium']
      },
      {
        name: 'basic-support',
        description: 'Standard configuration for basic support',
        configuration: {
          escalationThreshold: 8,
          responseStyle: 'friendly',
          enableSentimentAnalysis: false
        },
        tags: ['basic', 'standard']
      }
    ]
  },
  
  metadata: {
    author: 'Convergio Team',
    version: '1.0.0',
    category: 'customer-service',
    tags: ['support', 'customer-service', 'empathy', 'escalation'],
    lastUpdated: new Date(),
    usageCount: 0
  }
};