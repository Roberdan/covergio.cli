/**
 * Vector storage interfaces for the RAG system
 */

import { 
  TextChunk, 
  SearchResult, 
  VectorStoreConfig, 
  SearchFilter 
} from '../types/index.js';

export interface VectorStoreStats {
  totalVectors: number;
  dimensions: number;
  indexSize: number;
  memoryUsage: number;
  lastUpdated: Date;
}

export interface IVectorStore {
  /**
   * Initialize the vector store
   */
  initialize(config: VectorStoreConfig): Promise<void>;
  
  /**
   * Add documents with their embeddings
   */
  addDocuments(chunks: TextChunk[], embeddings: number[][]): Promise<void>;
  
  /**
   * Perform similarity search
   */
  similaritySearch(
    queryEmbedding: number[], 
    k: number, 
    filter?: SearchFilter
  ): Promise<SearchResult[]>;
  
  /**
   * Delete documents by IDs
   */
  deleteDocuments(documentIds: string[]): Promise<void>;
  
  /**
   * Update a single document
   */
  updateDocument(chunkId: string, chunk: TextChunk, embedding: number[]): Promise<void>;
  
  /**
   * Get vector store statistics
   */
  getStats(): Promise<VectorStoreStats>;
  
  /**
   * Check if vector store is ready
   */
  isReady(): boolean;
  
  /**
   * Persist to disk
   */
  persist(): Promise<void>;
  
  /**
   * Load from disk
   */
  load(): Promise<void>;
  
  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;
}