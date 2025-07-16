/**
 * RAG System Error Definitions
 * 
 * Comprehensive error handling with specific error types and categories
 */

import { ErrorCategory } from '../types/index.js';

export abstract class RAGError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack
    };
  }
}

// Document Processing Errors
export class DocumentProcessingError extends RAGError {
  readonly code = 'DOC_PROCESSING_ERROR';
  readonly category = ErrorCategory.PROCESSING;
}

export class UnsupportedDocumentFormatError extends RAGError {
  readonly code = 'UNSUPPORTED_FORMAT_ERROR';
  readonly category = ErrorCategory.PROCESSING;
}

export class DocumentExtractionError extends RAGError {
  readonly code = 'DOC_EXTRACTION_ERROR';
  readonly category = ErrorCategory.PROCESSING;
}

export class TextChunkingError extends RAGError {
  readonly code = 'TEXT_CHUNKING_ERROR';
  readonly category = ErrorCategory.PROCESSING;
}

// Embedding Errors
export class EmbeddingError extends RAGError {
  readonly code = 'EMBEDDING_ERROR';
  readonly category = ErrorCategory.EMBEDDING;
}

export class EmbeddingModelError extends RAGError {
  readonly code = 'EMBEDDING_MODEL_ERROR';
  readonly category = ErrorCategory.EMBEDDING;
}

export class EmbeddingGenerationError extends RAGError {
  readonly code = 'EMBEDDING_GENERATION_ERROR';
  readonly category = ErrorCategory.EMBEDDING;
}

export class ModelLoadingError extends RAGError {
  readonly code = 'MODEL_LOADING_ERROR';
  readonly category = ErrorCategory.EMBEDDING;
}

// Vector Store Errors
export class VectorStoreError extends RAGError {
  readonly code = 'VECTOR_STORE_ERROR';
  readonly category = ErrorCategory.STORAGE;
}

export class VectorIndexError extends RAGError {
  readonly code = 'VECTOR_INDEX_ERROR';
  readonly category = ErrorCategory.STORAGE;
}

export class SimilaritySearchError extends RAGError {
  readonly code = 'SIMILARITY_SEARCH_ERROR';
  readonly category = ErrorCategory.STORAGE;
}

export class VectorStoreInitializationError extends RAGError {
  readonly code = 'VECTOR_STORE_INIT_ERROR';
  readonly category = ErrorCategory.STORAGE;
}

// Agent Configuration Errors
export class AgentConfigurationError extends RAGError {
  readonly code = 'AGENT_CONFIG_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
}

export class AgentNotFoundError extends RAGError {
  readonly code = 'AGENT_NOT_FOUND_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
}

export class AgentValidationError extends RAGError {
  readonly code = 'AGENT_VALIDATION_ERROR';
  readonly category = ErrorCategory.VALIDATION;
}

export class KnowledgeBaseError extends RAGError {
  readonly code = 'KNOWLEDGE_BASE_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
}

export class KnowledgeBaseNotFoundError extends RAGError {
  readonly code = 'KNOWLEDGE_BASE_NOT_FOUND_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
}

// Query Processing Errors
export class QueryProcessingError extends RAGError {
  readonly code = 'QUERY_PROCESSING_ERROR';
  readonly category = ErrorCategory.PROCESSING;
}

export class ContextRetrievalError extends RAGError {
  readonly code = 'CONTEXT_RETRIEVAL_ERROR';
  readonly category = ErrorCategory.PROCESSING;
}

export class ResponseGenerationError extends RAGError {
  readonly code = 'RESPONSE_GENERATION_ERROR';
  readonly category = ErrorCategory.PROCESSING;
}

// System Errors
export class RAGSystemError extends RAGError {
  readonly code = 'RAG_SYSTEM_ERROR';
  readonly category = ErrorCategory.SYSTEM;
}

export class ConfigurationError extends RAGError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
}

export class ValidationError extends RAGError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = ErrorCategory.VALIDATION;
}

export class StorageError extends RAGError {
  readonly code = 'STORAGE_ERROR';
  readonly category = ErrorCategory.STORAGE;
}

export class NetworkError extends RAGError {
  readonly code = 'NETWORK_ERROR';
  readonly category = ErrorCategory.NETWORK;
}

// Error Factory Functions
export function createDocumentProcessingError(message: string, filePath?: string, format?: string): DocumentProcessingError {
  return new DocumentProcessingError(message, { filePath, format });
}

export function createEmbeddingError(message: string, modelName?: string, textLength?: number): EmbeddingError {
  return new EmbeddingError(message, { modelName, textLength });
}

export function createVectorStoreError(message: string, operation?: string, vectorCount?: number): VectorStoreError {
  return new VectorStoreError(message, { operation, vectorCount });
}

export function createAgentConfigurationError(message: string, agentId?: string, configField?: string): AgentConfigurationError {
  return new AgentConfigurationError(message, { agentId, configField });
}

export function createQueryProcessingError(message: string, query?: string, agentId?: string): QueryProcessingError {
  return new QueryProcessingError(message, { query, agentId });
}

// Error Handler Utility
export class RAGErrorHandler {
  private static errorCounts = new Map<string, number>();
  private static lastErrors = new Map<string, Date>();

  public static handleError(error: Error): RAGError {
    // Convert generic errors to RAG errors
    if (error instanceof RAGError) {
      this.recordError(error);
      return error;
    }

    // Convert common Node.js errors
    if (error.message.includes('ENOENT')) {
      const ragError = new StorageError(`File not found: ${error.message}`);
      this.recordError(ragError);
      return ragError;
    }

    if (error.message.includes('EACCES')) {
      const ragError = new StorageError(`Permission denied: ${error.message}`);
      this.recordError(ragError);
      return ragError;
    }

    if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
      const ragError = new RAGSystemError(`Too many open files: ${error.message}`);
      this.recordError(ragError);
      return ragError;
    }

    // Default to system error
    const ragError = new RAGSystemError(`Unexpected error: ${error.message}`);
    this.recordError(ragError);
    return ragError;
  }

  private static recordError(error: RAGError): void {
    const key = `${error.code}:${error.category}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    this.lastErrors.set(key, error.timestamp);
  }

  public static getErrorStats(): Record<string, { count: number; lastOccurrence: Date }> {
    const stats: Record<string, { count: number; lastOccurrence: Date }> = {};
    
    for (const [key, count] of this.errorCounts.entries()) {
      const lastOccurrence = this.lastErrors.get(key);
      if (lastOccurrence) {
        stats[key] = { count, lastOccurrence };
      }
    }
    
    return stats;
  }

  public static clearErrorStats(): void {
    this.errorCounts.clear();
    this.lastErrors.clear();
  }
}