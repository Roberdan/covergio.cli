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
 * Creative assistance specific request types
 */
export interface CreativeAssistantRequest extends AgentRequest {
  creativeType: 'writing' | 'brainstorming' | 'storytelling' | 'marketing' | 'design_brief' | 'content_strategy';
  contentFormat: 'blog_post' | 'social_media' | 'email' | 'presentation' | 'script' | 'proposal' | 'creative_brief';
  targetAudience?: {
    demographics: string[];
    interests: string[];
    tone_preference: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'playful';
  };
  constraints: {
    word_count?: number;
    style_guide?: string;
    brand_voice?: string;
    keywords?: string[];
    deadline?: string;
  };
  inspiration?: {
    reference_materials: string[];
    mood_board?: string[];
    competitor_examples?: string[];
  };
}

/**
 * Creative assistance response types
 */
export interface CreativeAssistantResponse extends AgentResponse {
  creativeOutput: {
    primary_content: string;
    alternative_versions?: string[];
    title_suggestions?: string[];
    meta_description?: string;
  };
  creativeProcess: {
    inspiration_sources: string[];
    brainstorming_notes: string[];
    iteration_count: number;
    style_analysis: string;
  };
  recommendations: {
    improvement_suggestions: string[];
    next_steps: string[];
    performance_predictions?: string[];
  };
  metadata: {
    word_count: number;
    readability_score: number;
    tone_analysis: string;
    originality_score: number;
  };
}

/**
 * Specialized creative assistant agent implementation
 */
export class CreativeAssistantAgent extends BaseAgent {
  private creativeFrameworks: Map<string, CreativeFramework> = new Map();
  private styleGuides: Map<string, StyleGuide> = new Map();
  private contentTemplates: Map<string, ContentTemplate> = new Map();
  private ideationTechniques: Map<string, IdeationTechnique> = new Map();

  constructor(config: AgentConfig) {
    super(config);
    this.initializeCreativeFrameworks();
    this.initializeStyleGuides();
    this.initializeContentTemplates();
    this.initializeIdeationTechniques();
  }

  /**
   * Execute creative assistance task
   */
  protected async executeTask(request: AgentRequest): Promise<AgentResponse> {
    const caRequest = request as CreativeAssistantRequest;
    
    // Validate creative request
    const validation = await this.validateCreativeRequest(caRequest);
    if (!validation.valid) {
      return this.createErrorResponse(validation.errors);
    }

    // Select appropriate creative framework
    const framework = this.selectCreativeFramework(caRequest);
    
    // Generate creative ideas through brainstorming
    const ideationResults = await this.performIdeation(caRequest, framework);
    
    // Create content based on selected ideas
    const contentGeneration = await this.generateContent(caRequest, ideationResults);
    
    // Refine and optimize content
    const refinedContent = await this.refineContent(caRequest, contentGeneration);
    
    // Analyze and provide feedback
    const analysis = await this.analyzeCreativeOutput(caRequest, refinedContent);
    
    return this.createCreativeResponse(caRequest, refinedContent, analysis);
  }

  /**
   * Validate creative request
   */
  private async validateCreativeRequest(request: CreativeAssistantRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check creative type
    const supportedTypes = ['writing', 'brainstorming', 'storytelling', 'marketing', 'design_brief', 'content_strategy'];
    if (!supportedTypes.includes(request.creativeType)) {
      errors.push(`Unsupported creative type: ${request.creativeType}`);
    }

    // Check content format
    const supportedFormats = ['blog_post', 'social_media', 'email', 'presentation', 'script', 'proposal', 'creative_brief'];
    if (!supportedFormats.includes(request.contentFormat)) {
      errors.push(`Unsupported content format: ${request.contentFormat}`);
    }

    // Validate constraints
    if (request.constraints.word_count && request.constraints.word_count < 10) {
      warnings.push('Very low word count may limit creative output quality');
    }

    if (request.constraints.word_count && request.constraints.word_count > 5000) {
      warnings.push('High word count may require extended processing time');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Select appropriate creative framework
   */
  private selectCreativeFramework(request: CreativeAssistantRequest): CreativeFramework {
    const frameworkKey = `${request.creativeType}_${request.contentFormat}`;
    return this.creativeFrameworks.get(frameworkKey) || this.creativeFrameworks.get('default')!;
  }

  /**
   * Perform ideation based on request
   */
  private async performIdeation(
    request: CreativeAssistantRequest, 
    framework: CreativeFramework
  ): Promise<IdeationResults> {
    const results: IdeationResults = {
      concepts: [],
      themes: [],
      angles: [],
      keywords: [],
      structure_options: []
    };

    // Apply different ideation techniques
    for (const technique of framework.ideation_techniques) {
      const techniqueHandler = this.ideationTechniques.get(technique);
      if (techniqueHandler) {
        const ideas = await techniqueHandler.generate(request);
        results.concepts.push(...ideas.concepts);
        results.themes.push(...ideas.themes);
        results.angles.push(...ideas.angles);
      }
    }

    // Enhance with inspiration sources
    if (request.inspiration) {
      results.concepts.push(...this.extractInspirationConcepts(request.inspiration));
    }

    // Filter and prioritize ideas
    results.concepts = this.prioritizeIdeas(results.concepts, request);
    results.themes = [...new Set(results.themes)]; // Remove duplicates
    results.angles = this.selectBestAngles(results.angles, request);

    return results;
  }

  /**
   * Generate content based on ideation
   */
  private async generateContent(
    request: CreativeAssistantRequest, 
    ideation: IdeationResults
  ): Promise<ContentGeneration> {
    const template = this.contentTemplates.get(request.contentFormat);
    if (!template) {
      throw new Error(`No template found for content format: ${request.contentFormat}`);
    }

    const generation: ContentGeneration = {
      primary_content: '',
      structure: template.structure,
      tone_applied: request.targetAudience?.tone_preference || 'professional',
      style_elements: [],
      word_count: 0
    };

    // Generate content sections based on template structure
    let content = '';
    for (const section of template.structure) {
      const sectionContent = await this.generateSection(section, ideation, request);
      content += sectionContent + '\n\n';
    }

    generation.primary_content = content.trim();
    generation.word_count = this.countWords(generation.primary_content);
    generation.style_elements = this.identifyStyleElements(generation.primary_content);

    return generation;
  }

  /**
   * Refine and optimize content
   */
  private async refineContent(
    request: CreativeAssistantRequest, 
    content: ContentGeneration
  ): Promise<ContentRefinement> {
    const refinement: ContentRefinement = {
      refined_content: content.primary_content,
      alternative_versions: [],
      improvements_made: [],
      readability_score: 0,
      tone_consistency: 0
    };

    // Apply style guide if specified
    if (request.constraints.style_guide) {
      const styleGuide = this.styleGuides.get(request.constraints.style_guide);
      if (styleGuide) {
        refinement.refined_content = this.applyStyleGuide(refinement.refined_content, styleGuide);
        refinement.improvements_made.push('Applied style guide');
      }
    }

    // Optimize for target audience
    if (request.targetAudience) {
      refinement.refined_content = this.optimizeForAudience(refinement.refined_content, request.targetAudience);
      refinement.improvements_made.push('Optimized for target audience');
    }

    // Ensure word count constraints
    if (request.constraints.word_count) {
      refinement.refined_content = this.adjustWordCount(
        refinement.refined_content, 
        request.constraints.word_count
      );
      refinement.improvements_made.push('Adjusted word count');
    }

    // Generate alternative versions
    refinement.alternative_versions = await this.generateAlternativeVersions(
      refinement.refined_content, 
      request
    );

    // Calculate quality metrics
    refinement.readability_score = this.calculateReadabilityScore(refinement.refined_content);
    refinement.tone_consistency = this.analyzeToneConsistency(
      refinement.refined_content, 
      request.targetAudience?.tone_preference || 'professional'
    );

    return refinement;
  }

  /**
   * Analyze creative output
   */
  private async analyzeCreativeOutput(
    request: CreativeAssistantRequest, 
    content: ContentRefinement
  ): Promise<CreativeAnalysis> {
    const analysis: CreativeAnalysis = {
      originality_score: 0,
      engagement_potential: 0,
      brand_alignment: 0,
      improvement_suggestions: [],
      performance_predictions: [],
      seo_recommendations: []
    };

    // Calculate originality
    analysis.originality_score = this.assessOriginality(content.refined_content);

    // Assess engagement potential
    analysis.engagement_potential = this.predictEngagement(content.refined_content, request);

    // Check brand alignment
    if (request.constraints.brand_voice) {
      analysis.brand_alignment = this.assessBrandAlignment(
        content.refined_content, 
        request.constraints.brand_voice
      );
    }

    // Generate improvement suggestions
    analysis.improvement_suggestions = this.generateImprovementSuggestions(content, request);

    // SEO recommendations if applicable
    if (request.contentFormat === 'blog_post' && request.constraints.keywords) {
      analysis.seo_recommendations = this.generateSEORecommendations(
        content.refined_content, 
        request.constraints.keywords
      );
    }

    // Performance predictions
    analysis.performance_predictions = this.predictContentPerformance(content, request);

    return analysis;
  }

  /**
   * Create creative response
   */
  private createCreativeResponse(
    request: CreativeAssistantRequest,
    content: ContentRefinement,
    analysis: CreativeAnalysis
  ): CreativeAssistantResponse {
    const titleSuggestions = this.generateTitleSuggestions(content.refined_content, request);
    const metaDescription = this.generateMetaDescription(content.refined_content);

    return {
      type: 'text',
      content: content.refined_content,
      creativeOutput: {
        primary_content: content.refined_content,
        alternative_versions: content.alternative_versions,
        title_suggestions: titleSuggestions,
        meta_description: metaDescription
      },
      creativeProcess: {
        inspiration_sources: request.inspiration?.reference_materials || [],
        brainstorming_notes: this.generateBrainstormingNotes(request),
        iteration_count: content.alternative_versions.length + 1,
        style_analysis: this.generateStyleAnalysis(content.refined_content)
      },
      recommendations: {
        improvement_suggestions: analysis.improvement_suggestions,
        next_steps: this.generateNextSteps(request, analysis),
        performance_predictions: analysis.performance_predictions
      },
      metadata: {
        word_count: this.countWords(content.refined_content),
        readability_score: content.readability_score,
        tone_analysis: this.analyzeTone(content.refined_content),
        originality_score: analysis.originality_score
      },
      context: request.context || {
        sessionId: '',
        executionId: '',
        timestamp: new Date(),
        environment: 'production'
      }
    };
  }

  /**
   * Generate section content
   */
  private async generateSection(
    section: ContentSection, 
    ideation: IdeationResults, 
    request: CreativeAssistantRequest
  ): Promise<string> {
    const relevantConcepts = ideation.concepts.filter(concept => 
      concept.relevance_score > 0.7
    ).slice(0, 3);

    switch (section.type) {
      case 'introduction':
        return this.generateIntroduction(relevantConcepts, request);
      case 'main_content':
        return this.generateMainContent(relevantConcepts, ideation.themes, request);
      case 'conclusion':
        return this.generateConclusion(relevantConcepts, request);
      case 'call_to_action':
        return this.generateCallToAction(request);
      default:
        return this.generateGenericSection(section, relevantConcepts, request);
    }
  }

  /**
   * Helper methods for content generation
   */
  private generateIntroduction(concepts: CreativeConcept[], request: CreativeAssistantRequest): string {
    const hook = concepts[0]?.description || 'Engaging opening statement';
    return `${hook}\n\nThis ${request.contentFormat.replace('_', ' ')} explores ${concepts.map(c => c.title).join(', ')}.`;
  }

  private generateMainContent(concepts: CreativeConcept[], themes: string[], request: CreativeAssistantRequest): string {
    let content = '';
    
    concepts.forEach((concept, index) => {
      content += `## ${concept.title}\n\n`;
      content += `${concept.description}\n\n`;
      
      if (themes[index]) {
        content += `This relates to the broader theme of ${themes[index]}.\n\n`;
      }
    });

    return content;
  }

  private generateConclusion(concepts: CreativeConcept[], request: CreativeAssistantRequest): string {
    return `In conclusion, ${concepts.map(c => c.title).join(' and ')} demonstrate the importance of ${request.creativeType} in achieving your goals.`;
  }

  private generateCallToAction(request: CreativeAssistantRequest): string {
    switch (request.contentFormat) {
      case 'blog_post':
        return 'What are your thoughts on this topic? Share your comments below!';
      case 'email':
        return 'Click here to learn more and take the next step.';
      case 'social_media':
        return 'Like and share if you found this helpful!';
      default:
        return 'Take action today to implement these insights.';
    }
  }

  private generateGenericSection(
    section: ContentSection, 
    concepts: CreativeConcept[], 
    request: CreativeAssistantRequest
  ): string {
    return `This section covers ${section.title} with insights from ${concepts.map(c => c.title).join(', ')}.`;
  }

  /**
   * Content optimization methods
   */
  private applyStyleGuide(content: string, styleGuide: StyleGuide): string {
    let optimizedContent = content;

    // Apply style guide rules
    for (const rule of styleGuide.rules) {
      if (rule.type === 'replace') {
        optimizedContent = optimizedContent.replace(
          new RegExp(rule.pattern, 'gi'), 
          rule.replacement
        );
      }
    }

    return optimizedContent;
  }

  private optimizeForAudience(content: string, audience: any): string {
    // Adjust tone and complexity based on audience
    if (audience.tone_preference === 'casual') {
      return content.replace(/\b(utilize|demonstrate|facilitate)\b/gi, 'use|show|help');
    }
    
    return content;
  }

  private adjustWordCount(content: string, targetCount: number): string {
    const currentCount = this.countWords(content);
    
    if (currentCount > targetCount * 1.1) {
      // Content is too long, trim it
      const words = content.split(' ');
      return words.slice(0, targetCount).join(' ') + '...';
    } else if (currentCount < targetCount * 0.9) {
      // Content is too short, expand it
      return content + '\n\nAdditional insights and details can be found by exploring this topic further.';
    }
    
    return content;
  }

  private async generateAlternativeVersions(
    content: string, 
    request: CreativeAssistantRequest
  ): Promise<string[]> {
    const alternatives: string[] = [];
    
    // Generate shorter version
    alternatives.push(this.generateShorterVersion(content));
    
    // Generate more formal version
    alternatives.push(this.generateFormalVersion(content));
    
    // Generate more engaging version
    alternatives.push(this.generateEngagingVersion(content));

    return alternatives;
  }

  private generateShorterVersion(content: string): string {
    // Simplified version with key points only
    const sentences = content.split('.').filter(s => s.trim());
    const keySentences = sentences.filter((_, index) => index % 2 === 0);
    return keySentences.join('. ') + '.';
  }

  private generateFormalVersion(content: string): string {
    return content
      .replace(/\bwe're\b/gi, 'we are')
      .replace(/\bdon't\b/gi, 'do not')
      .replace(/\bcan't\b/gi, 'cannot')
      .replace(/!/g, '.');
  }

  private generateEngagingVersion(content: string): string {
    const sentences = content.split('.');
    return sentences.map(sentence => {
      if (Math.random() > 0.7) {
        return sentence + ' - and here\'s why this matters to you';
      }
      return sentence;
    }).join('.');
  }

  /**
   * Analysis methods
   */
  private calculateReadabilityScore(content: string): number {
    const words = this.countWords(content);
    const sentences = content.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / sentences;
    
    // Simple readability calculation (higher is more readable)
    return Math.max(1, Math.min(10, 10 - (avgWordsPerSentence - 15) * 0.2));
  }

  private analyzeToneConsistency(content: string, targetTone: string): number {
    // Simplified tone analysis
    const toneKeywords = {
      professional: ['strategic', 'implement', 'optimize', 'achieve'],
      casual: ['hey', 'awesome', 'cool', 'pretty'],
      friendly: ['welcome', 'happy', 'excited', 'love'],
      authoritative: ['must', 'should', 'proven', 'expert']
    };

    const keywords = toneKeywords[targetTone as keyof typeof toneKeywords] || [];
    const matches = keywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length;

    return Math.min(10, (matches / keywords.length) * 10);
  }

  private assessOriginality(content: string): number {
    // Simplified originality assessment
    const commonPhrases = [
      'in conclusion',
      'first and foremost', 
      'at the end of the day',
      'think outside the box'
    ];

    const clicheCount = commonPhrases.filter(phrase => 
      content.toLowerCase().includes(phrase)
    ).length;

    return Math.max(1, 10 - clicheCount * 2);
  }

  private predictEngagement(content: string, request: CreativeAssistantRequest): number {
    let score = 5; // Base score

    // Questions increase engagement
    const questionCount = (content.match(/\?/g) || []).length;
    score += Math.min(2, questionCount * 0.5);

    // Emotional words increase engagement
    const emotionalWords = ['amazing', 'incredible', 'shocking', 'surprising'];
    const emotionalCount = emotionalWords.filter(word => 
      content.toLowerCase().includes(word)
    ).length;
    score += Math.min(2, emotionalCount * 0.3);

    // Lists and structure help engagement
    const listCount = (content.match(/\n\d+\./g) || []).length;
    score += Math.min(1, listCount * 0.2);

    return Math.min(10, score);
  }

  private assessBrandAlignment(content: string, brandVoice: string): number {
    // Simplified brand alignment check
    const brandKeywords = {
      'professional': ['expert', 'quality', 'reliable'],
      'innovative': ['cutting-edge', 'revolutionary', 'breakthrough'],
      'friendly': ['welcome', 'support', 'together']
    };

    const keywords = brandKeywords[brandVoice as keyof typeof brandKeywords] || [];
    const matches = keywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length;

    return Math.min(10, (matches / Math.max(1, keywords.length)) * 10);
  }

  /**
   * Utility methods
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private extractInspirationConcepts(inspiration: any): CreativeConcept[] {
    return inspiration.reference_materials.map((ref: string, index: number) => ({
      title: `Inspiration ${index + 1}`,
      description: `Concept inspired by ${ref}`,
      relevance_score: 0.8,
      category: 'inspiration'
    }));
  }

  private prioritizeIdeas(concepts: CreativeConcept[], request: CreativeAssistantRequest): CreativeConcept[] {
    return concepts.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 5);
  }

  private selectBestAngles(angles: string[], request: CreativeAssistantRequest): string[] {
    return angles.slice(0, 3); // Top 3 angles
  }

  private identifyStyleElements(content: string): string[] {
    const elements: string[] = [];
    
    if (content.includes('?')) elements.push('interrogative');
    if (content.includes('!')) elements.push('exclamatory');
    if (content.match(/\n\d+\./)) elements.push('numbered-list');
    if (content.includes('*') || content.includes('-')) elements.push('bullet-points');
    
    return elements;
  }

  private generateTitleSuggestions(content: string, request: CreativeAssistantRequest): string[] {
    const words = content.split(' ').slice(0, 10);
    const keyWords = words.filter(word => word.length > 4);
    
    return [
      `The Ultimate Guide to ${keyWords[0]}`,
      `How to Master ${keyWords[1] || 'This Topic'}`,
      `${keyWords[0]} vs ${keyWords[1]}: What You Need to Know`,
      `10 Ways to Improve Your ${keyWords[0]}`
    ];
  }

  private generateMetaDescription(content: string): string {
    const sentences = content.split('.').slice(0, 2);
    const description = sentences.join('.').substring(0, 150);
    return description + '...';
  }

  private generateBrainstormingNotes(request: CreativeAssistantRequest): string[] {
    return [
      `Initial concept: ${request.creativeType}`,
      `Target format: ${request.contentFormat}`,
      `Audience considerations noted`,
      'Multiple angles explored',
      'Style consistency maintained'
    ];
  }

  private generateStyleAnalysis(content: string): string {
    const wordCount = this.countWords(content);
    const sentences = content.split(/[.!?]+/).length;
    const avgSentenceLength = wordCount / sentences;

    if (avgSentenceLength < 15) return 'Concise and direct style';
    if (avgSentenceLength > 25) return 'Detailed and comprehensive style';
    return 'Balanced and accessible style';
  }

  private analyzeTone(content: string): string {
    if (content.includes('!') && content.includes('amazing')) return 'Enthusiastic';
    if (content.includes('must') && content.includes('should')) return 'Authoritative';
    if (content.includes('we') && content.includes('together')) return 'Collaborative';
    return 'Professional';
  }

  private generateImprovementSuggestions(content: ContentRefinement, request: CreativeAssistantRequest): string[] {
    const suggestions: string[] = [];

    if (content.readability_score < 7) {
      suggestions.push('Consider shorter sentences to improve readability');
    }

    if (content.tone_consistency < 7) {
      suggestions.push('Strengthen tone consistency throughout the content');
    }

    if (this.countWords(content.refined_content) < 300) {
      suggestions.push('Add more detail and examples to increase depth');
    }

    return suggestions;
  }

  private generateNextSteps(request: CreativeAssistantRequest, analysis: CreativeAnalysis): string[] {
    const steps = ['Review and edit for final polish'];

    if (request.contentFormat === 'blog_post') {
      steps.push('Optimize for SEO with relevant keywords');
      steps.push('Add relevant images and formatting');
    }

    if (analysis.engagement_potential < 7) {
      steps.push('Add more engaging elements like questions or examples');
    }

    steps.push('Test with target audience for feedback');

    return steps;
  }

  private generateSEORecommendations(content: string, keywords: string[]): string[] {
    const recommendations: string[] = [];

    keywords.forEach(keyword => {
      const count = (content.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      if (count === 0) {
        recommendations.push(`Include the keyword "${keyword}" naturally in the content`);
      } else if (count > 5) {
        recommendations.push(`Reduce usage of "${keyword}" to avoid keyword stuffing`);
      }
    });

    return recommendations;
  }

  private predictContentPerformance(content: ContentRefinement, request: CreativeAssistantRequest): string[] {
    const predictions: string[] = [];

    if (content.readability_score > 8) {
      predictions.push('High readability score suggests good audience engagement');
    }

    if (content.tone_consistency > 8) {
      predictions.push('Consistent tone likely to resonate with target audience');
    }

    predictions.push('Performance will depend on distribution strategy and timing');

    return predictions;
  }

  private createErrorResponse(errors: string[]): AgentResponse {
    return {
      type: 'error',
      content: `Creative assistance failed: ${errors.join(', ')}`,
      context: {
        sessionId: '',
        executionId: '',
        timestamp: new Date(),
        environment: 'production'
      }
    };
  }

  /**
   * Initialize creative frameworks
   */
  private initializeCreativeFrameworks(): void {
    this.creativeFrameworks.set('writing_blog_post', {
      name: 'Blog Post Writing',
      ideation_techniques: ['mind-mapping', 'problem-solution', 'storytelling'],
      structure_templates: ['introduction', 'main_content', 'conclusion', 'call_to_action'],
      tone_options: ['professional', 'casual', 'authoritative']
    });

    this.creativeFrameworks.set('marketing_social_media', {
      name: 'Social Media Marketing',
      ideation_techniques: ['trend-analysis', 'emotional-hooks', 'visual-storytelling'],
      structure_templates: ['hook', 'value_proposition', 'call_to_action'],
      tone_options: ['playful', 'friendly', 'professional']
    });

    this.creativeFrameworks.set('default', {
      name: 'General Creative Framework',
      ideation_techniques: ['brainstorming', 'concept-mapping'],
      structure_templates: ['introduction', 'main_content', 'conclusion'],
      tone_options: ['professional', 'casual']
    });
  }

  /**
   * Initialize style guides
   */
  private initializeStyleGuides(): void {
    this.styleGuides.set('ap_style', {
      name: 'AP Style Guide',
      rules: [
        { type: 'replace', pattern: 'more than', replacement: 'over', description: 'Use "over" for quantities' },
        { type: 'replace', pattern: 'email', replacement: 'e-mail', description: 'Hyphenate e-mail' }
      ],
      tone_guidelines: ['formal', 'objective', 'concise']
    });

    this.styleGuides.set('conversational', {
      name: 'Conversational Style',
      rules: [
        { type: 'replace', pattern: 'utilize', replacement: 'use', description: 'Use simpler language' },
        { type: 'replace', pattern: 'facilitate', replacement: 'help', description: 'Use everyday words' }
      ],
      tone_guidelines: ['friendly', 'accessible', 'personal']
    });
  }

  /**
   * Initialize content templates
   */
  private initializeContentTemplates(): void {
    this.contentTemplates.set('blog_post', {
      name: 'Blog Post Template',
      structure: [
        { type: 'introduction', title: 'Introduction', required: true },
        { type: 'main_content', title: 'Main Content', required: true },
        { type: 'conclusion', title: 'Conclusion', required: true },
        { type: 'call_to_action', title: 'Call to Action', required: false }
      ],
      word_count_range: { min: 500, max: 2000 }
    });

    this.contentTemplates.set('social_media', {
      name: 'Social Media Template',
      structure: [
        { type: 'hook', title: 'Hook', required: true },
        { type: 'value_proposition', title: 'Value', required: true },
        { type: 'call_to_action', title: 'CTA', required: true }
      ],
      word_count_range: { min: 20, max: 280 }
    });

    this.contentTemplates.set('email', {
      name: 'Email Template',
      structure: [
        { type: 'subject_line', title: 'Subject', required: true },
        { type: 'greeting', title: 'Greeting', required: true },
        { type: 'main_content', title: 'Body', required: true },
        { type: 'call_to_action', title: 'CTA', required: true },
        { type: 'closing', title: 'Closing', required: true }
      ],
      word_count_range: { min: 100, max: 500 }
    });
  }

  /**
   * Initialize ideation techniques
   */
  private initializeIdeationTechniques(): void {
    this.ideationTechniques.set('mind-mapping', {
      name: 'Mind Mapping',
      generate: async (request: CreativeAssistantRequest) => ({
        concepts: [
          { title: 'Central Theme', description: 'Main concept exploration', relevance_score: 0.9, category: 'core' },
          { title: 'Supporting Ideas', description: 'Related concepts and angles', relevance_score: 0.8, category: 'support' }
        ],
        themes: ['exploration', 'discovery', 'connection'],
        angles: ['analytical', 'creative', 'practical']
      })
    });

    this.ideationTechniques.set('problem-solution', {
      name: 'Problem-Solution Framework',
      generate: async (request: CreativeAssistantRequest) => ({
        concepts: [
          { title: 'Problem Identification', description: 'Identifying core challenges', relevance_score: 0.9, category: 'problem' },
          { title: 'Solution Framework', description: 'Comprehensive solution approach', relevance_score: 0.9, category: 'solution' }
        ],
        themes: ['challenge', 'resolution', 'improvement'],
        angles: ['analytical', 'systematic', 'results-focused']
      })
    });

    this.ideationTechniques.set('storytelling', {
      name: 'Storytelling Approach',
      generate: async (request: CreativeAssistantRequest) => ({
        concepts: [
          { title: 'Narrative Arc', description: 'Story structure and flow', relevance_score: 0.8, category: 'structure' },
          { title: 'Character Journey', description: 'Personal transformation story', relevance_score: 0.8, category: 'character' }
        ],
        themes: ['journey', 'transformation', 'discovery'],
        angles: ['personal', 'emotional', 'inspirational']
      })
    });
  }
}

/**
 * Supporting interfaces
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

interface CreativeFramework {
  name: string;
  ideation_techniques: string[];
  structure_templates: string[];
  tone_options: string[];
}

interface StyleGuide {
  name: string;
  rules: Array<{
    type: string;
    pattern: string;
    replacement: string;
    description: string;
  }>;
  tone_guidelines: string[];
}

interface ContentTemplate {
  name: string;
  structure: ContentSection[];
  word_count_range: { min: number; max: number };
}

interface ContentSection {
  type: string;
  title: string;
  required: boolean;
}

interface IdeationTechnique {
  name: string;
  generate: (request: CreativeAssistantRequest) => Promise<{
    concepts: CreativeConcept[];
    themes: string[];
    angles: string[];
  }>;
}

interface CreativeConcept {
  title: string;
  description: string;
  relevance_score: number;
  category: string;
}

interface IdeationResults {
  concepts: CreativeConcept[];
  themes: string[];
  angles: string[];
  keywords: string[];
  structure_options: string[];
}

interface ContentGeneration {
  primary_content: string;
  structure: ContentSection[];
  tone_applied: string;
  style_elements: string[];
  word_count: number;
}

interface ContentRefinement {
  refined_content: string;
  alternative_versions: string[];
  improvements_made: string[];
  readability_score: number;
  tone_consistency: number;
}

interface CreativeAnalysis {
  originality_score: number;
  engagement_potential: number;
  brand_alignment: number;
  improvement_suggestions: string[];
  performance_predictions: string[];
  seo_recommendations: string[];
}

/**
 * Creative assistant agent template
 */
export const CreativeAssistantTemplate: DomainAgentTemplate = {
  id: 'creative:assistant',
  domain: 'creative',
  role: 'assistant',
  description: 'Specialized agent for creative content generation, brainstorming, and content strategy',
  defaultCapabilities: [
    'content-generation',
    'creative-brainstorming',
    'style-adaptation',
    'audience-optimization',
    'content-analysis'
  ],
  defaultPersonalityTraits: [
    { name: 'creative', value: 0.9, description: 'Highly creative and imaginative', category: 'creativity' },
    { name: 'adaptable', value: 0.8, description: 'Adapts style to different audiences', category: 'social' },
    { name: 'inspirational', value: 0.8, description: 'Generates inspiring content', category: 'creativity' },
    { name: 'collaborative', value: 0.7, description: 'Works well with creative feedback', category: 'social' },
    { name: 'detail-oriented', value: 0.7, description: 'Pays attention to style and tone', category: 'problem-solving' }
  ],
  defaultTools: [
    'content-generator',
    'style-analyzer',
    'brainstorming-framework',
    'audience-profiler',
    'performance-predictor'
  ],
  configSchema: {
    type: 'object',
    properties: {
      creativityLevel: { type: 'number', minimum: 1, maximum: 10 },
      defaultTone: { type: 'string', enum: ['professional', 'casual', 'friendly', 'authoritative'] },
      enableSEOOptimization: { type: 'boolean' },
      maxWordCount: { type: 'number', minimum: 50 }
    }
  },
  examples: [
    'Write engaging blog posts',
    'Create social media content',
    'Develop marketing copy',
    'Generate creative briefs'
  ],
  documentation: 'Creative assistant agent specialized in content generation, brainstorming, and creative strategy. Adapts to different styles and audiences.',
  
  domainSpecific: {
    knowledgeBase: [
      'content-marketing-strategies',
      'creative-writing-techniques',
      'audience-psychology',
      'brand-voice-guidelines',
      'seo-best-practices'
    ],
    specializedTools: [
      'idea-generator',
      'tone-analyzer',
      'readability-checker',
      'engagement-predictor',
      'style-guide-enforcer'
    ],
    communicationPatterns: [
      {
        name: 'creative-brainstorming',
        description: 'Energetic brainstorming approach',
        triggers: ['ideas', 'brainstorm', 'creative'],
        responseTemplate: 'Let\'s explore some exciting possibilities for {topic}!',
        tone: 'friendly',
        context: ['ideation', 'brainstorming']
      },
      {
        name: 'content-refinement',
        description: 'Constructive feedback and improvement suggestions',
        triggers: ['improve', 'refine', 'feedback'],
        responseTemplate: 'Here are some ways to enhance your {content_type}.',
        tone: 'analytical',
        context: ['editing', 'optimization']
      }
    ],
    behaviorRules: [
      {
        name: 'audience-first',
        description: 'Always consider target audience in content creation',
        condition: 'request.targetAudience !== null',
        action: 'optimize_for_audience',
        priority: 1,
        active: true
      },
      {
        name: 'originality-check',
        description: 'Ensure content originality and avoid clichés',
        condition: 'content.generated === true',
        action: 'assess_originality',
        priority: 2,
        active: true
      }
    ],
    validationRules: [
      {
        field: 'creativeType',
        rule: 'value && ["writing", "brainstorming", "storytelling", "marketing", "design_brief", "content_strategy"].includes(value)',
        message: 'Creative type must be one of: writing, brainstorming, storytelling, marketing, design_brief, content_strategy',
        severity: 'error'
      }
    ]
  },
  
  inheritance: {
    baseTemplate: undefined,
    mixins: ['creative-mixin', 'content-mixin']
  },
  
  customization: {
    configurableFields: [
      {
        name: 'creativityLevel',
        type: 'number',
        description: 'Level of creativity in content generation (1-10)',
        defaultValue: 7,
        required: false,
        validation: { min: 1, max: 10 }
      },
      {
        name: 'defaultTone',
        type: 'string',
        description: 'Default tone for content creation',
        defaultValue: 'professional',
        required: false,
        options: ['professional', 'casual', 'friendly', 'authoritative', 'playful']
      },
      {
        name: 'contentLength',
        type: 'string',
        description: 'Preferred content length',
        defaultValue: 'medium',
        required: false,
        options: ['short', 'medium', 'long', 'comprehensive']
      }
    ],
    presets: [
      {
        name: 'marketing-content',
        description: 'Optimized for marketing and promotional content',
        configuration: {
          creativityLevel: 8,
          defaultTone: 'engaging',
          contentLength: 'medium'
        },
        tags: ['marketing', 'promotional']
      },
      {
        name: 'educational-content',
        description: 'Optimized for educational and informational content',
        configuration: {
          creativityLevel: 6,
          defaultTone: 'professional',
          contentLength: 'long'
        },
        tags: ['education', 'informational']
      }
    ]
  },
  
  metadata: {
    author: 'Convergio Team',
    version: '1.0.0',
    category: 'creative',
    tags: ['content', 'writing', 'creativity', 'marketing'],
    lastUpdated: new Date(),
    usageCount: 0
  }
};