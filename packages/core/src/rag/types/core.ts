/**
 * Core types for the RAG system
 */

export enum DocumentFormat {
  PDF = 'pdf',
  TXT = 'txt',
  MD = 'md',
  DOCX = 'docx'
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum ChunkingStrategy {
  FIXED_SIZE = 'fixed_size',
  SEMANTIC = 'semantic',
  SENTENCE = 'sentence',
  PARAGRAPH = 'paragraph'
}

export enum IndexType {
  FLAT = 'flat',
  HNSW = 'hnsw',
  IVF = 'ivf'
}

export enum DistanceMetric {
  COSINE = 'cosine',
  EUCLIDEAN = 'euclidean',
  DOT_PRODUCT = 'dot_product'
}

export enum ErrorCategory {
  PROCESSING = 'processing',
  EMBEDDING = 'embedding',
  STORAGE = 'storage',
  CONFIGURATION = 'configuration',
  QUERY = 'query'
}

export interface DocumentMetadata {
  fileName: string;
  filePath: string;
  format: DocumentFormat;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  author?: string;
  title?: string;
  language?: string;
  [key: string]: any;
}

export interface ChunkMetadata {
  documentId: string;
  chunkIndex: number;
  startPage?: number;
  endPage?: number;
  section?: string;
  subsection?: string;
  [key: string]: any;
}

export interface ExtractedContent {
  text: string;
  metadata: DocumentMetadata;
  pageCount?: number;
  wordCount: number;
}

export interface TextChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  startIndex: number;
  endIndex: number;
  embedding?: number[];
}

export interface SearchResult {
  chunk: TextChunk;
  score: number;
  distance: number;
}

export interface SourceReference {
  documentId: string;
  chunkId: string;
  fileName: string;
  pageNumber?: number;
  section?: string;
  relevanceScore: number;
}