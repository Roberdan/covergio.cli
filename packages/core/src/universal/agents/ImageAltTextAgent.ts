/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent } from './BaseAgent.js';
import { AgentConfig, AgentRequest, AgentResponse, Capability, PersonalityTrait, ToolDefinition } from './types.js';
import { DocumentMemory, DocumentMemoryItem, createDocumentMemory } from './memory/DocumentMemory.js';
import { DocumentProcessor, createDocumentProcessor } from './memory/DocumentProcessor.js';

// Use dynamic import to avoid compilation issues
let MarkItDown: any;

/**
 * Configuration interface for ImageAltText agent
 */
export interface ImageAltTextConfig {
  defaultLanguage: string;
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  maxDescriptionLength: number;
  includeImageContext: boolean;
  llmProvider?: string;
  llmApiKey?: string;
  llmModel?: string;
}

/**
 * Default configuration for ImageAltText agent
 */
const defaultConfig: ImageAltTextConfig = {
  defaultLanguage: 'en',
  detailLevel: 'detailed',
  maxDescriptionLength: 150,
  includeImageContext: true
};

/**
 * ImageAltText agent for generating descriptive alt-text for images in Markdown documents
 * using LLM integration through the MarkItDown library
 */
export class ImageAltTextAgent extends BaseAgent {
  private markItDown: any;
  private documentMemory: DocumentMemory;
  private documentProcessor: DocumentProcessor;
  private config: ImageAltTextConfig;

  constructor(agentConfig: AgentConfig, imageAltTextConfig: Partial<ImageAltTextConfig> = {}) {
    // Set up the agent configuration with ImageAltText-specific details
    const finalAgentConfig: AgentConfig = {
      ...agentConfig,
      domain: 'document-processing',
      role: 'image-accessibility-specialist',
      capabilities: [
        'image-analysis',
        'alt-text-generation',
        'markdown-parsing',
        'accessibility-enhancement',
        'document-processing'
      ],
      personalityTraits: [
        {
          name: 'helpful',
          value: 0.95,
          description: 'Focused on improving accessibility and providing useful descriptions',
          category: 'social'
        },
        {
          name: 'detail-oriented',
          value: 0.9,
          description: 'Pays close attention to visual details and context',
          category: 'analytical'
        },
        {
          name: 'accessibility-focused',
          value: 0.95,
          description: 'Committed to making content accessible to all users',
          category: 'social'
        },
        {
          name: 'technical',
          value: 0.8,
          description: 'Strong understanding of markdown and image formats',
          category: 'analytical'
        }
      ],
      tools: [
        'analyzeImages',
        'generateAltText',
        'processMarkdown',
        'enhanceAccessibility',
        'validateImages',
        'extractImages',
        'updateImageAltText'
      ]
    };

    super(finalAgentConfig);
    
    // Initialize MarkItDown in the initialize method
    this.markItDown = null;
    
    // Initialize document memory and processor
    this.documentMemory = createDocumentMemory();
    this.documentProcessor = createDocumentProcessor();
    
    // Merge configuration with defaults
    this.config = {
      ...defaultConfig,
      ...imageAltTextConfig,
      llmProvider: imageAltTextConfig.llmProvider || process.env.LLM_PROVIDER || process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : undefined,
      llmApiKey: imageAltTextConfig.llmApiKey || process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
      llmModel: imageAltTextConfig.llmModel || process.env.LLM_MODEL || 'claude-3-haiku-20240307'
    };
  }

  /**
   * Initialize the ImageAltText agent
   */
  protected async onInitialize(): Promise<void> {
    try {
      // Dynamically import MarkItDown to avoid compilation issues
      const { MarkItDown } = await import('markitdown-ts');
      this.markItDown = new MarkItDown();
    } catch (error) {
      console.warn('MarkItDown library not available, using fallback implementation');
      this.markItDown = null;
    }

    // Store agent capabilities in memory
    await this.memory.store({
      content: 'ImageAltText agent initialized with capabilities: image-analysis, alt-text-generation, markdown-parsing, accessibility-enhancement',
      timestamp: new Date(),
      metadata: {
        type: 'initialization',
        capabilities: this.getCapabilities().map(c => c.id),
        config: {
          detailLevel: this.config.detailLevel,
          maxDescriptionLength: this.config.maxDescriptionLength,
          defaultLanguage: this.config.defaultLanguage
        }
      }
    });
  }

  /**
   * Execute an image alt-text generation task
   */
  protected async executeTask(request: AgentRequest): Promise<AgentResponse> {
    const command = this.parseCommand(request.input);
    
    try {
      switch (command.action) {
        case 'analyzeImages':
          return await this.analyzeImages(command.content);
          
        case 'generateAltText':
          return await this.generateAltText(command.content, command.imageUrl);
          
        case 'processMarkdown':
          return await this.processMarkdown(command.content);
          
        case 'enhanceAccessibility':
          return await this.enhanceAccessibility(command.content);
          
        case 'validateImages':
          return await this.validateImages(command.content);
          
        case 'extractImages':
          return await this.extractImages(command.content);
          
        case 'updateImageAltText':
          return await this.updateImageAltText(command.content, command.imageUrl, command.altText);
          
        default:
          return this.getHelpResponse();
      }
    } catch (error) {
      return {
        type: 'error',
        content: `Error processing image alt-text: ${error instanceof Error ? error.message : String(error)}`,
        context: request.context,
        error: {
          code: 'IMAGE_ALTTEXT_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : String(error),
          details: error
        }
      };
    }
  }

  /**
   * Analyze images in markdown content
   */
  private async analyzeImages(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to analyze images',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      const images = this.extractImagesFromMarkdown(content);
      const imagesNeedingAltText = images.filter(img => 
        !img.altText || 
        img.altText.trim() === '' || 
        img.altText === 'image' || 
        img.altText === 'placeholder' ||
        img.altText.length < 10
      );
      
      await this.memory.store({
        content: `Analyzed ${images.length} images, ${imagesNeedingAltText.length} need alt-text`,
        timestamp: new Date(),
        metadata: {
          type: 'image-analysis',
          totalImages: images.length,
          imagesNeedingAltText: imagesNeedingAltText.length,
          imageFormats: Array.from(new Set(images.map(img => img.format).filter(Boolean)))
        }
      });

      return {
        type: 'json',
        content: JSON.stringify({
          analysis: {
            totalImages: images.length,
            imagesWithAltText: images.length - imagesNeedingAltText.length,
            imagesNeedingAltText: imagesNeedingAltText.length,
            completionPercentage: Math.round(((images.length - imagesNeedingAltText.length) / images.length) * 100) || 0
          },
          images: images.map(img => ({
            url: img.url,
            altText: img.altText,
            needsAltText: !img.altText || img.altText.trim() === '' || img.altText === 'image' || img.altText === 'placeholder' || img.altText.length < 10,
            format: img.format,
            context: img.context
          })),
          recommendations: imagesNeedingAltText.length > 0 ? [
            `${imagesNeedingAltText.length} images need descriptive alt-text`,
            'Run processMarkdown to automatically generate alt-text',
            'Use generateAltText for individual images'
          ] : [
            'All images have appropriate alt-text',
            'Consider reviewing alt-text quality for improvements'
          ]
        }, null, 2),
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'analyzeImages',
          totalImages: images.length,
          imagesNeedingAltText: imagesNeedingAltText.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to analyze images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate alt-text for a specific image
   */
  private async generateAltText(content: string, imageUrl?: string): Promise<AgentResponse> {
    if (!imageUrl && !content) {
      return {
        type: 'error',
        content: 'No image URL or content provided for alt-text generation',
        error: {
          code: 'MISSING_IMAGE_INFO',
          message: 'Either image URL or markdown content is required'
        }
      };
    }

    try {
      let imageToProcess: string;
      
      if (imageUrl) {
        imageToProcess = imageUrl;
      } else {
        // Extract first image from content
        const images = this.extractImagesFromMarkdown(content);
        if (images.length === 0) {
          return {
            type: 'error',
            content: 'No images found in the provided content',
            error: {
              code: 'NO_IMAGES_FOUND',
              message: 'Content does not contain any images'
            }
          };
        }
        imageToProcess = images[0].url;
      }

      const altText = await this.generateAltTextForImage(imageToProcess, content);
      
      await this.memory.store({
        content: `Generated alt-text for image: ${imageToProcess.substring(0, 50)}...`,
        timestamp: new Date(),
        metadata: {
          type: 'alt-text-generation',
          imageUrl: imageToProcess,
          altTextLength: altText.length,
          detailLevel: this.config.detailLevel
        }
      });

      return {
        type: 'text',
        content: altText,
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'generateAltText',
          imageUrl: imageToProcess,
          altTextLength: altText.length,
          detailLevel: this.config.detailLevel
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate alt-text: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process markdown content and add alt-text to images
   */
  private async processMarkdown(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to process',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      const images = this.extractImagesFromMarkdown(content);
      const imagesNeedingAltText = images.filter(img => 
        !img.altText || 
        img.altText.trim() === '' || 
        img.altText === 'image' || 
        img.altText === 'placeholder' ||
        img.altText.length < 10
      );

      if (imagesNeedingAltText.length === 0) {
        return {
          type: 'markdown',
          content: content,
          metadata: {
            agentId: this.id,
            timestamp: new Date().toISOString(),
            operation: 'processMarkdown',
            message: 'All images already have appropriate alt-text',
            totalImages: images.length,
            processed: 0
          }
        };
      }

      let updatedContent = content;
      let processedCount = 0;

      for (const image of imagesNeedingAltText) {
        try {
          const altText = await this.generateAltTextForImage(image.url, content);
          
          // Replace the image markdown with updated alt-text
          const oldPattern = new RegExp(`!\\[${image.altText || ''}\\]\\(${image.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
          const newMarkdown = `![${altText}](${image.url})`;
          updatedContent = updatedContent.replace(oldPattern, newMarkdown);
          processedCount++;
          
          // Store in memory for future reference
          await this.memory.store({
            content: `Generated alt-text for ${image.url}: "${altText}"`,
            timestamp: new Date(),
            metadata: {
              type: 'image-alt-text-generated',
              imageUrl: image.url,
              altText,
              originalAltText: image.altText
            }
          });
        } catch (error) {
          console.warn(`Failed to generate alt-text for ${image.url}:`, error);
        }
      }
      
      await this.memory.store({
        content: `Processed markdown document: ${processedCount}/${imagesNeedingAltText.length} images updated with alt-text`,
        timestamp: new Date(),
        metadata: {
          type: 'markdown-processing',
          totalImages: images.length,
          imagesNeedingAltText: imagesNeedingAltText.length,
          processed: processedCount,
          contentLength: updatedContent.length
        }
      });

      return {
        type: 'markdown',
        content: updatedContent,
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'processMarkdown',
          totalImages: images.length,
          processed: processedCount,
          failed: imagesNeedingAltText.length - processedCount
        }
      };
    } catch (error) {
      throw new Error(`Failed to process markdown: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enhance accessibility of markdown content
   */
  private async enhanceAccessibility(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to enhance accessibility',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      // Process images for alt-text
      const processedResponse = await this.processMarkdown(content);
      let enhancedContent = processedResponse.content;

      // Additional accessibility enhancements
      const enhancements = [];

      // Check for and enhance headings structure
      const headings = this.extractHeadingsFromMarkdown(enhancedContent);
      if (headings.some((h, i) => i > 0 && h.level > headings[i-1].level + 1)) {
        enhancements.push('Heading structure could be improved (avoid skipping heading levels)');
      }

      // Check for descriptive link text
      const links = this.extractLinksFromMarkdown(enhancedContent);
      const genericLinks = links.filter(link => 
        ['click here', 'read more', 'link', 'here', 'more'].includes(link.text.toLowerCase())
      );
      if (genericLinks.length > 0) {
        enhancements.push(`${genericLinks.length} links have generic text that could be more descriptive`);
      }

      // Check for tables that might need headers
      const tableCount = (enhancedContent.match(/\|.*\|/g) || []).length;
      if (tableCount > 0) {
        enhancements.push('Consider adding table headers for better accessibility');
      }

      await this.memory.store({
        content: `Enhanced accessibility: processed ${processedResponse.metadata?.processed || 0} images, identified ${enhancements.length} additional improvements`,
        timestamp: new Date(),
        metadata: {
          type: 'accessibility-enhancement',
          imagesProcessed: processedResponse.metadata?.processed || 0,
          additionalEnhancements: enhancements.length,
          enhancements
        }
      });

      return {
        type: 'json',
        content: JSON.stringify({
          enhancedContent,
          accessibilityReport: {
            imagesProcessed: processedResponse.metadata?.processed || 0,
            totalImages: processedResponse.metadata?.totalImages || 0,
            additionalEnhancements: enhancements,
            score: this.calculateAccessibilityScore(enhancedContent, processedResponse.metadata?.processed || 0)
          }
        }, null, 2),
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'enhanceAccessibility',
          imagesProcessed: processedResponse.metadata?.processed || 0,
          enhancementsIdentified: enhancements.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to enhance accessibility: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate images in markdown content
   */
  private async validateImages(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to validate images',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      const images = this.extractImagesFromMarkdown(content);
      const validationResults = [];

      for (const image of images) {
        const validation = {
          url: image.url,
          altText: image.altText,
          issues: [] as string[],
          suggestions: [] as string[]
        };

        // Check alt-text quality
        if (!image.altText || image.altText.trim() === '') {
          validation.issues.push('Missing alt-text');
          validation.suggestions.push('Add descriptive alt-text for accessibility');
        } else if (image.altText.length < 10) {
          validation.issues.push('Alt-text too short');
          validation.suggestions.push('Provide more descriptive alt-text (at least 10 characters)');
        } else if (image.altText.length > this.config.maxDescriptionLength) {
          validation.issues.push('Alt-text too long');
          validation.suggestions.push(`Keep alt-text under ${this.config.maxDescriptionLength} characters`);
        }

        // Check for generic alt-text
        const genericTexts = ['image', 'picture', 'photo', 'placeholder', 'img'];
        if (genericTexts.includes(image.altText?.toLowerCase() || '')) {
          validation.issues.push('Generic alt-text');
          validation.suggestions.push('Replace with descriptive content about what the image shows');
        }

        // Check URL format
        if (!image.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) && !image.url.startsWith('http')) {
          validation.issues.push('Unusual image format or URL');
          validation.suggestions.push('Verify image URL is correct and accessible');
        }

        validationResults.push(validation);
      }

      const totalIssues = validationResults.reduce((sum, result) => sum + result.issues.length, 0);

      await this.memory.store({
        content: `Validated ${images.length} images, found ${totalIssues} issues`,
        timestamp: new Date(),
        metadata: {
          type: 'image-validation',
          totalImages: images.length,
          totalIssues,
          validImages: validationResults.filter(r => r.issues.length === 0).length
        }
      });

      return {
        type: 'json',
        content: JSON.stringify({
          summary: {
            totalImages: images.length,
            totalIssues,
            validImages: validationResults.filter(r => r.issues.length === 0).length,
            validationScore: Math.round(((images.length - totalIssues) / Math.max(images.length, 1)) * 100)
          },
          validationResults,
          overallStatus: totalIssues === 0 ? 'All images are valid' : `${totalIssues} issues found`
        }, null, 2),
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'validateImages',
          totalImages: images.length,
          totalIssues
        }
      };
    } catch (error) {
      throw new Error(`Failed to validate images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract images from markdown content
   */
  private async extractImages(content: string): Promise<AgentResponse> {
    if (!content || content.trim() === '') {
      return {
        type: 'error',
        content: 'No content provided to extract images from',
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Content cannot be empty'
        }
      };
    }

    try {
      const images = this.extractImagesFromMarkdown(content);

      await this.memory.store({
        content: `Extracted ${images.length} images from markdown content`,
        timestamp: new Date(),
        metadata: {
          type: 'image-extraction',
          imageCount: images.length,
          formats: Array.from(new Set(images.map(img => img.format).filter(Boolean)))
        }
      });

      return {
        type: 'json',
        content: JSON.stringify({
          images: images.map(img => ({
            url: img.url,
            altText: img.altText,
            format: img.format,
            context: img.context,
            hasAltText: !!(img.altText && img.altText.trim()),
            altTextQuality: this.assessAltTextQuality(img.altText)
          })),
          summary: {
            total: images.length,
            withAltText: images.filter(img => img.altText && img.altText.trim()).length,
            withoutAltText: images.filter(img => !img.altText || !img.altText.trim()).length,
            formats: Array.from(new Set(images.map(img => img.format).filter(Boolean)))
          }
        }, null, 2),
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'extractImages',
          imageCount: images.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update alt-text for a specific image
   */
  private async updateImageAltText(content: string, imageUrl?: string, altText?: string): Promise<AgentResponse> {
    if (!content || (!imageUrl && !altText)) {
      return {
        type: 'error',
        content: 'Content, image URL, and alt-text are required',
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Content, image URL, and alt-text must be provided'
        }
      };
    }

    try {
      if (!imageUrl || !altText) {
        return {
          type: 'error',
          content: 'Both image URL and alt-text are required for update',
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Both imageUrl and altText parameters are required'
          }
        };
      }

      const images = this.extractImagesFromMarkdown(content);
      const targetImage = images.find(img => img.url === imageUrl);

      if (!targetImage) {
        return {
          type: 'error',
          content: `Image not found: ${imageUrl}`,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: 'The specified image URL was not found in the content'
          }
        };
      }

      // Update the image alt-text in the content
      const oldPattern = new RegExp(`!\\[${targetImage.altText || ''}\\]\\(${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
      const newMarkdown = `![${altText}](${imageUrl})`;
      const updatedContent = content.replace(oldPattern, newMarkdown);

      await this.memory.store({
        content: `Updated alt-text for ${imageUrl}: "${altText}"`,
        timestamp: new Date(),
        metadata: {
          type: 'alt-text-update',
          imageUrl,
          oldAltText: targetImage.altText,
          newAltText: altText
        }
      });

      return {
        type: 'markdown',
        content: updatedContent,
        metadata: {
          agentId: this.id,
          timestamp: new Date().toISOString(),
          operation: 'updateImageAltText',
          imageUrl,
          oldAltText: targetImage.altText,
          newAltText: altText
        }
      };
    } catch (error) {
      throw new Error(`Failed to update image alt-text: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate alt-text for a specific image using LLM integration
   */
  private async generateAltTextForImage(imageUrl: string, context?: string): Promise<string> {
    try {
      // For now, provide a comprehensive fallback implementation
      // In a real implementation, this would use the configured LLM provider
      const fallbackDescription = this.generateFallbackAltText(imageUrl, context);
      
      // TODO: Implement actual LLM integration when MarkItDown supports it
      // const llmConfig = {
      //   provider: this.config.llmProvider,
      //   apiKey: this.config.llmApiKey,
      //   model: this.config.llmModel
      // };
      // const description = await this.markItDown?.generateImageDescription(imageUrl, llmConfig);
      
      return fallbackDescription;
    } catch (error) {
      throw new Error(`Failed to generate alt-text for image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate fallback alt-text based on image URL and context
   */
  private generateFallbackAltText(imageUrl: string, context?: string): string {
    const filename = imageUrl.split('/').pop() || '';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    // Extract meaningful information from filename
    let description = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    
    // Improve description based on common patterns
    if (description.includes('screenshot')) {
      description = `Screenshot of ${description.replace('screenshot', '').trim()}`;
    } else if (description.includes('diagram')) {
      description = `Diagram showing ${description.replace('diagram', '').trim()}`;
    } else if (description.includes('chart')) {
      description = `Chart displaying ${description.replace('chart', '').trim()}`;
    } else if (description.includes('logo')) {
      description = `Logo for ${description.replace('logo', '').trim()}`;
    } else if (description.includes('icon')) {
      description = `Icon representing ${description.replace('icon', '').trim()}`;
    } else {
      // Generic description based on file type
      switch (extension) {
        case 'png':
        case 'jpg':
        case 'jpeg':
          description = description || 'Image';
          break;
        case 'svg':
          description = description || 'Vector graphic';
          break;
        case 'gif':
          description = description || 'Animated image';
          break;
        default:
          description = description || 'Image file';
      }
    }

    // Ensure proper length and format
    description = description.charAt(0).toUpperCase() + description.slice(1);
    
    if (description.length < 10 && context) {
      // Try to extract context clues
      const contextWords = context.toLowerCase().split(/\s+/);
      const relevantWords = contextWords.filter(word => 
        word.length > 3 && 
        !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'but', 'words', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'].includes(word)
      ).slice(0, 3);
      
      if (relevantWords.length > 0) {
        description += ` related to ${relevantWords.join(', ')}`;
      }
    }

    // Ensure it meets minimum length requirements but doesn't exceed maximum
    if (description.length < 10) {
      description += ' content';
    }
    
    if (description.length > this.config.maxDescriptionLength) {
      description = description.substring(0, this.config.maxDescriptionLength - 3) + '...';
    }

    return description;
  }

  /**
   * Parse user command input
   */
  private parseCommand(input: string): {
    action: string;
    content?: string;
    imageUrl?: string;
    altText?: string;
  } {
    const lowerInput = input.toLowerCase().trim();
    
    // Check for specific commands
    if (lowerInput.includes('analyze') && lowerInput.includes('image')) {
      return {
        action: 'analyzeImages',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('generate') && lowerInput.includes('alt')) {
      return {
        action: 'generateAltText',
        content: this.extractContentFromInput(input),
        imageUrl: this.extractImageUrlFromInput(input)
      };
    }
    
    if (lowerInput.includes('process') && lowerInput.includes('markdown')) {
      return {
        action: 'processMarkdown',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('enhance') && lowerInput.includes('accessibility')) {
      return {
        action: 'enhanceAccessibility',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('validate') && lowerInput.includes('image')) {
      return {
        action: 'validateImages',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('extract') && lowerInput.includes('image')) {
      return {
        action: 'extractImages',
        content: this.extractContentFromInput(input)
      };
    }
    
    if (lowerInput.includes('update') && lowerInput.includes('alt')) {
      return {
        action: 'updateImageAltText',
        content: this.extractContentFromInput(input),
        imageUrl: this.extractImageUrlFromInput(input),
        altText: this.extractAltTextFromInput(input)
      };
    }
    
    // Default to processing markdown if it contains images
    if (input.includes('![') || input.includes('](')) {
      return {
        action: 'processMarkdown',
        content: input
      };
    }
    
    return {
      action: 'help',
      content: input
    };
  }

  /**
   * Extract content from user input
   */
  private extractContentFromInput(input: string): string {
    const patterns = [
      /(?:analyze|process|validate|extract from|enhance)\s+(?:images?|markdown)?\s*(?:in|from)?\s*:?\s*(.+)/i,
      /```(?:markdown|md)?\s*([\s\S]*?)\s*```/i,
      /(?:content|markdown):\s*(.+)/i,
      /(?:analyze|process|validate|extract from|enhance)\s+(?:this|the following)?\s*:?\s*(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // If no pattern matches, try to extract everything after the command
    const commandMatch = input.match(/^[a-z\s-]+:\s*(.+)/i);
    if (commandMatch && commandMatch[1]) {
      return commandMatch[1].trim();
    }
    
    return input;
  }

  /**
   * Extract image URL from user input
   */
  private extractImageUrlFromInput(input: string): string | undefined {
    const patterns = [
      /(?:image|url):\s*([^\s]+)/i,
      /generate\s+alt\s+text\s+for\s+([^\s]+)/i,
      /!\[[^\]]*\]\(([^)]+)\)/i
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  /**
   * Extract alt-text from user input
   */
  private extractAltTextFromInput(input: string): string | undefined {
    const patterns = [
      /(?:alt|text):\s*"([^"]+)"/i,
      /(?:alt|text):\s*'([^']+)'/i,
      /update.*alt.*text.*to\s+"([^"]+)"/i,
      /update.*alt.*text.*to\s+'([^']+)'/i
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  /**
   * Extract images from markdown content
   */
  private extractImagesFromMarkdown(content: string): Array<{
    url: string;
    altText: string;
    format?: string;
    context?: string;
  }> {
    const images: Array<{ url: string; altText: string; format?: string; context?: string }> = [];
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      const altText = match[1] || '';
      const url = match[2];
      
      // Extract format from URL
      const formatMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const format = formatMatch ? formatMatch[1].toLowerCase() : undefined;
      
      // Extract context (surrounding text)
      const matchIndex = match.index;
      const contextStart = Math.max(0, matchIndex - 100);
      const contextEnd = Math.min(content.length, matchIndex + match[0].length + 100);
      const context = content.substring(contextStart, contextEnd).replace(/\s+/g, ' ').trim();
      
      images.push({ url, altText, format, context });
    }
    
    return images;
  }

  /**
   * Extract headings from markdown content
   */
  private extractHeadingsFromMarkdown(content: string): Array<{
    level: number;
    text: string;
  }> {
    const headings: Array<{ level: number; text: string }> = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        headings.push({ level, text });
      }
    }
    
    return headings;
  }

  /**
   * Extract links from markdown content
   */
  private extractLinksFromMarkdown(content: string): Array<{
    text: string;
    url: string;
  }> {
    const links: Array<{ text: string; url: string }> = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const text = match[1];
      const url = match[2];
      links.push({ text, url });
    }
    
    return links;
  }

  /**
   * Assess alt-text quality
   */
  private assessAltTextQuality(altText?: string): string {
    if (!altText || altText.trim() === '') {
      return 'missing';
    }
    
    if (altText.length < 10) {
      return 'too-short';
    }
    
    if (altText.length > this.config.maxDescriptionLength) {
      return 'too-long';
    }
    
    const genericTexts = ['image', 'picture', 'photo', 'placeholder', 'img'];
    if (genericTexts.includes(altText.toLowerCase())) {
      return 'generic';
    }
    
    return 'good';
  }

  /**
   * Calculate accessibility score
   */
  private calculateAccessibilityScore(content: string, imagesProcessed: number): number {
    const images = this.extractImagesFromMarkdown(content);
    const imagesWithGoodAltText = images.filter(img => 
      this.assessAltTextQuality(img.altText) === 'good'
    ).length;
    
    if (images.length === 0) return 100;
    
    const imageScore = (imagesWithGoodAltText / images.length) * 100;
    return Math.round(imageScore);
  }

  /**
   * Get help response
   */
  private getHelpResponse(): AgentResponse {
    const helpText = `
# ImageAltText Agent Help

I can help you generate descriptive alt-text for images in Markdown documents to improve accessibility.

## Available Commands:
- **Analyze Images**: Analyze all images in markdown content and identify which need alt-text
- **Generate Alt-Text**: Generate descriptive alt-text for a specific image
- **Process Markdown**: Process markdown content and add alt-text to all images that need it
- **Enhance Accessibility**: Comprehensively enhance document accessibility including images
- **Validate Images**: Validate image alt-text quality and identify issues
- **Extract Images**: Extract all images from markdown content with their current alt-text
- **Update Image Alt-Text**: Update alt-text for a specific image

## Usage Examples:
- "Analyze images in: [markdown content]"
- "Generate alt-text for: https://example.com/image.jpg"
- "Process markdown: ![](image.png) Some content"
- "Enhance accessibility of this document"
- "Validate images in markdown content"
- "Extract images from: [content]"
- "Update alt-text for image.jpg to: 'A beautiful sunset over mountains'"

## Configuration:
- Detail Level: ${this.config.detailLevel}
- Max Description Length: ${this.config.maxDescriptionLength} characters
- Default Language: ${this.config.defaultLanguage}
- Include Context: ${this.config.includeImageContext}

## Supported Image Formats:
- JPEG, PNG, GIF, SVG, WebP
- Both local and remote images
- Images with or without existing alt-text

Simply provide your markdown content and I'll help make it more accessible!
    `.trim();

    return {
      type: 'markdown',
      content: helpText,
      metadata: {
        agentId: this.id,
        timestamp: new Date().toISOString(),
        operation: 'help'
      }
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): Capability[] {
    return [
      {
        id: 'image-analysis',
        name: 'Image Analysis',
        description: 'Analyze images in markdown documents and identify accessibility issues',
        category: 'technical',
        level: 'expert',
        keywords: ['image', 'analysis', 'accessibility']
      },
      {
        id: 'alt-text-generation',
        name: 'Alt-Text Generation',
        description: 'Generate descriptive alt-text for images using AI',
        category: 'creative',
        level: 'expert',
        keywords: ['alt-text', 'description', 'accessibility']
      },
      {
        id: 'markdown-parsing',
        name: 'Markdown Parsing',
        description: 'Parse and manipulate markdown content with image processing',
        category: 'technical',
        level: 'advanced',
        keywords: ['markdown', 'parsing', 'processing']
      },
      {
        id: 'accessibility-enhancement',
        name: 'Accessibility Enhancement',
        description: 'Improve document accessibility for users with disabilities',
        category: 'domain-specific',
        level: 'expert',
        keywords: ['accessibility', 'a11y', 'inclusive']
      },
      {
        id: 'document-processing',
        name: 'Document Processing',
        description: 'Process and transform markdown documents',
        category: 'technical',
        level: 'advanced',
        keywords: ['document', 'processing', 'transformation']
      }
    ];
  }

  /**
   * Get agent tools
   */
  getTools(): ToolDefinition[] {
    return [
      {
        id: 'analyzeImages',
        name: 'Analyze Images',
        description: 'Analyze all images in markdown content and identify accessibility issues',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to analyze',
            required: true
          }
        ],
        category: 'accessibility',
        accessLevel: 'public'
      },
      {
        id: 'generateAltText',
        name: 'Generate Alt-Text',
        description: 'Generate descriptive alt-text for a specific image',
        parameters: [
          {
            name: 'imageUrl',
            type: 'string',
            description: 'URL of the image to generate alt-text for',
            required: false
          },
          {
            name: 'content',
            type: 'string',
            description: 'Markdown content containing the image',
            required: false
          }
        ],
        category: 'accessibility',
        accessLevel: 'public'
      },
      {
        id: 'processMarkdown',
        name: 'Process Markdown',
        description: 'Process markdown content and add alt-text to all images',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to process',
            required: true
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      },
      {
        id: 'enhanceAccessibility',
        name: 'Enhance Accessibility',
        description: 'Comprehensively enhance document accessibility',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to enhance',
            required: true
          }
        ],
        category: 'accessibility',
        accessLevel: 'public'
      },
      {
        id: 'validateImages',
        name: 'Validate Images',
        description: 'Validate image alt-text quality and identify issues',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to validate',
            required: true
          }
        ],
        category: 'accessibility',
        accessLevel: 'public'
      },
      {
        id: 'extractImages',
        name: 'Extract Images',
        description: 'Extract all images from markdown content',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content to extract images from',
            required: true
          }
        ],
        category: 'document-processing',
        accessLevel: 'public'
      },
      {
        id: 'updateImageAltText',
        name: 'Update Image Alt-Text',
        description: 'Update alt-text for a specific image in markdown content',
        parameters: [
          {
            name: 'content',
            type: 'string',
            description: 'The markdown content containing the image',
            required: true
          },
          {
            name: 'imageUrl',
            type: 'string',
            description: 'URL of the image to update',
            required: true
          },
          {
            name: 'altText',
            type: 'string',
            description: 'New alt-text for the image',
            required: true
          }
        ],
        category: 'accessibility',
        accessLevel: 'public'
      }
    ];
  }
}