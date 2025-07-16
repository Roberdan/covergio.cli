/**
 * Embedding service interfaces for the RAG system
 */

export interface EmbeddingModelInfo {
  name: string;
  dimensions: number;
  maxTokens: number;
  language: string;
  modelSize: number;
}

export interface IEmbeddingService {
  /**
   * Initialize the embedding service
   */
  initialize(): Promise<void>;
  
  /**
   * Generate embedding for a single text
   */
  embedText(text: string): Promise<number[]>;
  
  /**
   * Generate embeddings for multiple texts
   */
  embedBatch(texts: string[]): Promise<number[][]>;
  
  /**
   * Get embedding dimensions
   */
  getDimensions(): number;
  
  /**
   * Get model information
   */
  getModelInfo(): EmbeddingModelInfo;
  
  /**
   * Check if service is ready
   */
  isReady(): boolean;
  
  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;
}