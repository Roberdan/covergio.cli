/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmbeddingGenerator } from './interfaces.js';
import {
  EmbeddingRequest,
  EmbeddingResult,
  EmbeddingModelConfig,
  EmbeddingProvider,
  MultiModalEmbeddingRequest
} from './types.js';

/**
 * Universal embedding generator supporting multiple providers
 */
export class UniversalEmbeddingGenerator implements EmbeddingGenerator {
  private config?: EmbeddingModelConfig;
  private initialized = false;

  /**
   * Initialize the embedding generator
   */
  async initialize(config: EmbeddingModelConfig): Promise<void> {
    this.config = config;
    
    // Validate configuration
    if (!config.name || !config.provider || !config.dimensions) {
      throw new Error('Invalid embedding model configuration');
    }

    // Provider-specific initialization
    await this.initializeProvider(config);
    
    this.initialized = true;
  }

  /**
   * Generate embeddings for content
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!this.initialized || !this.config) {
      throw new Error('Embedding generator not initialized');
    }

    const startTime = Date.now();

    try {
      // Preprocess content
      const processedContent = await this.preprocessContent(request.content, request.contentType);
      
      // Generate embeddings based on provider
      const embeddings = await this.generateEmbeddings(processedContent, request);
      
      const executionTime = Date.now() - startTime;

      return {
        embeddings,
        model: this.config.name,
        modelVersion: this.getModelVersion(),
        generationTime: executionTime,
        tokenUsage: this.calculateTokenUsage(processedContent)
      };

    } catch (error) {
      throw new Error(`Failed to generate embeddings: ${(error as Error).message}`);
    }
  }

  /**
   * Generate embeddings for multiple items
   */
  async embedBatch(requests: EmbeddingRequest[]): Promise<EmbeddingResult> {
    if (!this.initialized || !this.config) {
      throw new Error('Embedding generator not initialized');
    }

    const startTime = Date.now();
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    try {
      // Process in batches to avoid API limits
      const batchSize = this.getBatchSize();
      
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchContent = await Promise.all(
          batch.map(req => this.preprocessContent(req.content, req.contentType))
        );

        const batchEmbeddings = await this.generateBatchEmbeddings(batchContent, batch[0]);
        allEmbeddings.push(...batchEmbeddings);
        
        // Calculate token usage for batch
        totalTokens += batchContent.reduce((sum, content) => 
          sum + this.calculateTokenUsage(content).total, 0
        );
      }

      const executionTime = Date.now() - startTime;

      return {
        embeddings: allEmbeddings,
        model: this.config.name,
        modelVersion: this.getModelVersion(),
        generationTime: executionTime,
        tokenUsage: {
          total: totalTokens,
          prompt: totalTokens
        }
      };

    } catch (error) {
      throw new Error(`Failed to generate batch embeddings: ${(error as Error).message}`);
    }
  }

  /**
   * Generate multi-modal embeddings
   */
  async embedMultiModal(request: MultiModalEmbeddingRequest): Promise<EmbeddingResult> {
    if (!this.initialized || !this.config) {
      throw new Error('Embedding generator not initialized');
    }

    const startTime = Date.now();

    try {
      const embeddings = await this.generateMultiModalEmbeddings(request);
      const executionTime = Date.now() - startTime;

      return {
        embeddings: [embeddings],
        model: this.config.name,
        modelVersion: this.getModelVersion(),
        generationTime: executionTime,
        tokenUsage: this.calculateMultiModalTokenUsage(request)
      };

    } catch (error) {
      throw new Error(`Failed to generate multi-modal embeddings: ${(error as Error).message}`);
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<{
    name: string;
    dimensions: number;
    maxInputLength: number;
    provider: string;
  }> {
    if (!this.config) {
      throw new Error('Embedding generator not initialized');
    }

    return {
      name: this.config.name,
      dimensions: this.config.dimensions,
      maxInputLength: this.config.maxInputLength,
      provider: this.config.provider
    };
  }

  /**
   * Check if model is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.initialized || !this.config) {
      return false;
    }

    try {
      // Try a simple embedding request to check availability
      await this.embed({
        content: 'test',
        contentType: 'text'
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize provider-specific settings
   */
  private async initializeProvider(config: EmbeddingModelConfig): Promise<void> {
    switch (config.provider) {
      case EmbeddingProvider.OPENAI:
        await this.initializeOpenAI(config);
        break;
      case EmbeddingProvider.COHERE:
        await this.initializeCohere(config);
        break;
      case EmbeddingProvider.HUGGING_FACE:
        await this.initializeHuggingFace(config);
        break;
      case EmbeddingProvider.GOOGLE:
        await this.initializeGoogle(config);
        break;
      case EmbeddingProvider.SENTENCE_TRANSFORMERS:
        await this.initializeSentenceTransformers(config);
        break;
      case EmbeddingProvider.LOCAL:
        await this.initializeLocal(config);
        break;
      default:
        throw new Error(`Unsupported embedding provider: ${config.provider}`);
    }
  }

  /**
   * Initialize OpenAI embedding provider
   */
  private async initializeOpenAI(config: EmbeddingModelConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    // Validate model name
    const validModels = ['text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large'];
    if (!validModels.includes(config.name)) {
      throw new Error(`Invalid OpenAI model: ${config.name}`);
    }
  }

  /**
   * Initialize Cohere embedding provider
   */
  private async initializeCohere(config: EmbeddingModelConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Cohere API key is required');
    }
  }

  /**
   * Initialize Hugging Face embedding provider
   */
  private async initializeHuggingFace(config: EmbeddingModelConfig): Promise<void> {
    // Hugging Face can work without API key for public models
    if (!config.endpoint) {
      config.endpoint = 'https://api-inference.huggingface.co/pipeline/feature-extraction';
    }
  }

  /**
   * Initialize Google embedding provider
   */
  private async initializeGoogle(config: EmbeddingModelConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Google API key is required');
    }
  }

  /**
   * Initialize Sentence Transformers (local) provider
   */
  private async initializeSentenceTransformers(config: EmbeddingModelConfig): Promise<void> {
    // For local sentence transformers, no API key needed
    // Could check if the model is available locally
  }

  /**
   * Initialize local embedding provider
   */
  private async initializeLocal(config: EmbeddingModelConfig): Promise<void> {
    if (!config.endpoint) {
      throw new Error('Local embedding endpoint is required');
    }
  }

  /**
   * Preprocess content before embedding
   */
  private async preprocessContent(content: string | any[], contentType: string): Promise<string> {
    if (Array.isArray(content)) {
      return content.join(' ');
    }

    if (typeof content !== 'string') {
      return JSON.stringify(content);
    }

    // Basic text preprocessing
    let processed = content;

    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ').trim();

    // Truncate if too long
    if (this.config && processed.length > this.config.maxInputLength) {
      processed = processed.substring(0, this.config.maxInputLength);
    }

    return processed;
  }

  /**
   * Generate embeddings based on provider
   */
  private async generateEmbeddings(content: string, request: EmbeddingRequest): Promise<number[][]> {
    if (!this.config) {
      throw new Error('Configuration not available');
    }

    switch (this.config.provider) {
      case EmbeddingProvider.OPENAI:
        return this.generateOpenAIEmbeddings(content);
      case EmbeddingProvider.COHERE:
        return this.generateCohereEmbeddings(content);
      case EmbeddingProvider.HUGGING_FACE:
        return this.generateHuggingFaceEmbeddings(content);
      case EmbeddingProvider.GOOGLE:
        return this.generateGoogleEmbeddings(content);
      case EmbeddingProvider.SENTENCE_TRANSFORMERS:
        return this.generateSentenceTransformersEmbeddings(content);
      case EmbeddingProvider.LOCAL:
        return this.generateLocalEmbeddings(content);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Generate OpenAI embeddings
   */
  private async generateOpenAIEmbeddings(content: string): Promise<number[][]> {
    if (!this.config) throw new Error('Configuration not available');

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.name,
        input: content
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }

  /**
   * Generate Cohere embeddings
   */
  private async generateCohereEmbeddings(content: string): Promise<number[][]> {
    if (!this.config) throw new Error('Configuration not available');

    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.name,
        texts: [content]
      })
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings;
  }

  /**
   * Generate Hugging Face embeddings
   */
  private async generateHuggingFaceEmbeddings(content: string): Promise<number[][]> {
    if (!this.config) throw new Error('Configuration not available');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(
      `${this.config.endpoint}/${this.config.name}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: content
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data[0]) ? data : [data];
  }

  /**
   * Generate Google embeddings
   */
  private async generateGoogleEmbeddings(content: string): Promise<number[][]> {
    if (!this.config) throw new Error('Configuration not available');

    // Implementation would depend on specific Google embedding service
    throw new Error('Google embeddings not yet implemented');
  }

  /**
   * Generate Sentence Transformers embeddings
   */
  private async generateSentenceTransformersEmbeddings(content: string): Promise<number[][]> {
    // This would require a local server running sentence transformers
    throw new Error('Sentence Transformers embeddings not yet implemented');
  }

  /**
   * Generate local embeddings
   */
  private async generateLocalEmbeddings(content: string): Promise<number[][]> {
    if (!this.config) throw new Error('Configuration not available');

    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.name,
        input: content
      })
    });

    if (!response.ok) {
      throw new Error(`Local embedding service error: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? [data] : data.embeddings || [data.embedding];
  }

  /**
   * Generate batch embeddings
   */
  private async generateBatchEmbeddings(
    contents: string[],
    sampleRequest: EmbeddingRequest
  ): Promise<number[][]> {
    // For most providers, batch is more efficient
    const allEmbeddings: number[][] = [];
    
    for (const content of contents) {
      const embeddings = await this.generateEmbeddings(content, sampleRequest);
      allEmbeddings.push(...embeddings);
    }
    
    return allEmbeddings;
  }

  /**
   * Generate multi-modal embeddings
   */
  private async generateMultiModalEmbeddings(request: MultiModalEmbeddingRequest): Promise<number[]> {
    // Multi-modal embedding implementation would depend on provider support
    // For now, combine text and other modalities using simple concatenation
    
    const embeddings: number[][] = [];
    
    if (request.text) {
      const textEmbeddings = await this.generateEmbeddings(request.text, {
        content: request.text,
        contentType: 'text'
      });
      embeddings.push(...textEmbeddings);
    }

    // For image and audio, we'd need specialized models
    // For now, return text embeddings or empty vector
    if (embeddings.length === 0) {
      return new Array(this.config?.dimensions || 1536).fill(0);
    }

    return embeddings[0];
  }

  /**
   * Get model version
   */
  private getModelVersion(): string {
    return this.config?.parameters?.version || '1.0.0';
  }

  /**
   * Calculate token usage
   */
  private calculateTokenUsage(content: string): { total: number; prompt: number } {
    // Rough approximation: 1 token ≈ 4 characters
    const tokens = Math.ceil(content.length / 4);
    return { total: tokens, prompt: tokens };
  }

  /**
   * Calculate multi-modal token usage
   */
  private calculateMultiModalTokenUsage(request: MultiModalEmbeddingRequest): { total: number; prompt: number } {
    let tokens = 0;
    
    if (request.text) {
      tokens += Math.ceil(request.text.length / 4);
    }
    
    // Add tokens for other modalities (simplified)
    if (request.image) tokens += 100;
    if (request.audio) tokens += 200;
    
    return { total: tokens, prompt: tokens };
  }

  /**
   * Get optimal batch size for provider
   */
  private getBatchSize(): number {
    if (!this.config) return 1;
    
    switch (this.config.provider) {
      case EmbeddingProvider.OPENAI:
        return 100; // OpenAI supports up to 2048 inputs
      case EmbeddingProvider.COHERE:
        return 96; // Cohere supports up to 96 texts
      case EmbeddingProvider.HUGGING_FACE:
        return 10; // Conservative for API limits
      default:
        return 1;
    }
  }
}