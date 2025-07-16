/**
 * Local Embedding Service
 * 
 * Provides local text embedding using Transformers.js
 * Will be implemented in Task 3
 */

import { IEmbeddingService, EmbeddingConfig, EmbeddingModelInfo } from '../types/index.js';

export class LocalEmbeddingService implements IEmbeddingService {
  constructor(private config: EmbeddingConfig) {}

  // Placeholder methods - will be implemented in Task 3
  public async initialize(): Promise<void> {
    console.log('LocalEmbeddingService initialized (placeholder)');
  }

  public async embedText(text: string): Promise<number[]> {
    throw new Error('LocalEmbeddingService not yet implemented - Task 3');
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    throw new Error('LocalEmbeddingService not yet implemented - Task 3');
  }

  public getDimensions(): number {
    return this.config.dimensions;
  }

  public getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.config.modelName,
      dimensions: this.config.dimensions,
      maxTokens: 512,
      language: 'multilingual',
      version: '1.0.0',
      size: 0
    };
  }
}