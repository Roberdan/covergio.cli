/**
 * Knowledge base related types for the RAG system
 */

import { DocumentFormat, ProcessingStatus } from './core.js';

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: DocumentReference[];
  createdAt: Date;
  updatedAt: Date;
  stats: KnowledgeBaseStats;
  settings: KnowledgeBaseSettings;
}

export interface DocumentReference {
  id: string;
  filePath: string;
  fileName: string;
  format: DocumentFormat;
  size: number;
  processedAt: Date;
  chunkCount: number;
  status: ProcessingStatus;
  checksum: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeBaseStats {
  totalDocuments: number;
  totalChunks: number;
  totalTokens: number;
  averageChunkSize: number;
  lastUpdated: Date;
  processingStatus: ProcessingStatus;
  errorCount: number;
}

export interface KnowledgeBaseSettings {
  autoUpdate: boolean;
  chunkingStrategy: string;
  embeddingModel: string;
  maxDocumentSize: number;
  allowedFormats: DocumentFormat[];
}

export interface ProcessingResult {
  documentId: string;
  success: boolean;
  chunkCount: number;
  processingTime: number;
  error?: string;
  warnings: string[];
}

export interface BatchProcessingResult {
  totalDocuments: number;
  successCount: number;
  failureCount: number;
  results: ProcessingResult[];
  totalProcessingTime: number;
}