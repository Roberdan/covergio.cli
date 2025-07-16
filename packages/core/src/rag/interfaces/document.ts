/**
 * Document processing interfaces for the RAG system
 */

import { 
  DocumentFormat, 
  ExtractedContent, 
  TextChunk, 
  ChunkingOptions 
} from '../types/index.js';

export interface ITextExtractor {
  /**
   * Extract text content from a document
   */
  extractText(filePath: string, format: DocumentFormat): Promise<ExtractedContent>;
  
  /**
   * Get supported document formats
   */
  getSupportedFormats(): DocumentFormat[];
  
  /**
   * Validate if a file can be processed
   */
  canProcess(filePath: string): Promise<boolean>;
}

export interface ITextChunker {
  /**
   * Split text content into chunks
   */
  chunkText(content: ExtractedContent, options: ChunkingOptions): Promise<TextChunk[]>;
  
  /**
   * Get optimal chunk size for given content
   */
  getOptimalChunkSize(content: ExtractedContent): number;
  
  /**
   * Validate chunking options
   */
  validateOptions(options: ChunkingOptions): boolean;
}

export interface IDocumentProcessor {
  /**
   * Process a single document end-to-end
   */
  processDocument(filePath: string): Promise<TextChunk[]>;
  
  /**
   * Process multiple documents in batch
   */
  processBatch(filePaths: string[]): Promise<Map<string, TextChunk[]>>;
  
  /**
   * Get processing status
   */
  getProcessingStatus(documentId: string): Promise<string>;
}