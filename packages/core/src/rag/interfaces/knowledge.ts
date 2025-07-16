/**
 * Knowledge base management interfaces for the RAG system
 */

import { 
  KnowledgeBase, 
  DocumentReference, 
  ProcessingResult,
  BatchProcessingResult 
} from '../types/index.js';

export interface IKnowledgeBaseManager {
  /**
   * Create a new knowledge base
   */
  createKnowledgeBase(name: string, description: string): Promise<KnowledgeBase>;
  
  /**
   * Get a knowledge base by ID
   */
  getKnowledgeBase(id: string): Promise<KnowledgeBase | null>;
  
  /**
   * List all knowledge bases
   */
  listKnowledgeBases(): Promise<KnowledgeBase[]>;
  
  /**
   * Update knowledge base metadata
   */
  updateKnowledgeBase(id: string, updates: Partial<KnowledgeBase>): Promise<void>;
  
  /**
   * Delete a knowledge base
   */
  deleteKnowledgeBase(id: string): Promise<void>;
  
  /**
   * Add documents to a knowledge base
   */
  addDocuments(kbId: string, filePaths: string[]): Promise<BatchProcessingResult>;
  
  /**
   * Remove documents from a knowledge base
   */
  removeDocuments(kbId: string, documentIds: string[]): Promise<void>;
  
  /**
   * Update documents in a knowledge base
   */
  updateDocuments(kbId: string, documentIds: string[]): Promise<BatchProcessingResult>;
  
  /**
   * Get document processing status
   */
  getProcessingStatus(kbId: string, documentId: string): Promise<ProcessingResult>;
}