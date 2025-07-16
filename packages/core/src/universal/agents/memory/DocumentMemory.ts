/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentMemory, MemoryItem } from '../types.js';

/**
 * Document-specific memory item interface
 */
export interface DocumentMemoryItem extends MemoryItem {
  documentType: 'markdown' | 'html' | 'text' | 'other';
  documentStructure?: DocumentStructure;
  originalContent?: string;
  processedContent?: string;
  fileInfo?: {
    filename?: string;
    size?: number;
    lastModified?: Date;
    encoding?: string;
  };
  parseResult?: {
    headings?: HeadingInfo[];
    links?: LinkInfo[];
    images?: ImageInfo[];
    tables?: TableInfo[];
    codeBlocks?: CodeBlockInfo[];
    listItems?: ListItemInfo[];
  };
}

/**
 * Document structure representation
 */
export interface DocumentStructure {
  type: 'document';
  title?: string;
  sections: DocumentSection[];
  wordCount?: number;
  readingTime?: number;
  language?: string;
  metadata?: DocumentMetadata;
}

/**
 * Document section representation
 */
export interface DocumentSection {
  id: string;
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'image' | 'quote' | 'other';
  level?: number;
  title?: string;
  content: string;
  children?: DocumentSection[];
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  title?: string;
  author?: string;
  created?: Date;
  modified?: Date;
  tags?: string[];
  description?: string;
  version?: string;
  frontMatter?: Record<string, any>;
}

/**
 * Heading information
 */
export interface HeadingInfo {
  level: number;
  text: string;
  id?: string;
  lineNumber?: number;
  anchor?: string;
}

/**
 * Link information
 */
export interface LinkInfo {
  text: string;
  url: string;
  title?: string;
  type: 'internal' | 'external' | 'anchor';
  lineNumber?: number;
}

/**
 * Image information
 */
export interface ImageInfo {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  lineNumber?: number;
}

/**
 * Table information
 */
export interface TableInfo {
  headers: string[];
  rows: string[][];
  caption?: string;
  lineNumber?: number;
}

/**
 * Code block information
 */
export interface CodeBlockInfo {
  language?: string;
  code: string;
  lineNumber?: number;
  filename?: string;
}

/**
 * List item information
 */
export interface ListItemInfo {
  type: 'ordered' | 'unordered';
  level: number;
  text: string;
  checked?: boolean;
  lineNumber?: number;
}

/**
 * Document memory implementation specialized for markdown documents
 */
export class DocumentMemory implements AgentMemory {
  private documents = new Map<string, DocumentMemoryItem>();
  private nextId = 1;

  /**
   * Store a document memory item
   */
  async store(item: MemoryItem): Promise<string> {
    const id = `doc-${this.nextId++}`;
    const documentItem: DocumentMemoryItem = {
      id,
      ...item,
      timestamp: item.timestamp || new Date(),
      documentType: this.determineDocumentType(item),
    };

    this.documents.set(id, documentItem);
    return id;
  }

  /**
   * Store a document with specific document information
   */
  async storeDocument(
    content: string,
    documentType: DocumentMemoryItem['documentType'],
    structure?: DocumentStructure,
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = `doc-${this.nextId++}`;
    const documentItem: DocumentMemoryItem = {
      id,
      content,
      timestamp: new Date(),
      documentType,
      documentStructure: structure,
      metadata,
    };

    this.documents.set(id, documentItem);
    return id;
  }

  /**
   * Retrieve documents based on query
   */
  async retrieve(query: string, limit = 10): Promise<DocumentMemoryItem[]> {
    const results = Array.from(this.documents.values())
      .filter(doc => this.matchesQuery(doc, query))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return results;
  }

  /**
   * Retrieve documents by type
   */
  async retrieveByType(
    documentType: DocumentMemoryItem['documentType'],
    limit = 10
  ): Promise<DocumentMemoryItem[]> {
    const results = Array.from(this.documents.values())
      .filter(doc => doc.documentType === documentType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return results;
  }

  /**
   * Retrieve documents with specific structure elements
   */
  async retrieveByStructure(
    structureQuery: Partial<DocumentStructure>,
    limit = 10
  ): Promise<DocumentMemoryItem[]> {
    const results = Array.from(this.documents.values())
      .filter(doc => this.matchesStructure(doc, structureQuery))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return results;
  }

  /**
   * Update a document memory item
   */
  async update(id: string, item: Partial<DocumentMemoryItem>): Promise<void> {
    const existing = this.documents.get(id);
    if (existing) {
      this.documents.set(id, { ...existing, ...item });
    }
  }

  /**
   * Update document structure
   */
  async updateStructure(id: string, structure: DocumentStructure): Promise<void> {
    const existing = this.documents.get(id);
    if (existing) {
      this.documents.set(id, { ...existing, documentStructure: structure });
    }
  }

  /**
   * Delete a document memory item
   */
  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    this.documents.clear();
  }

  /**
   * Get document by ID
   */
  async getById(id: string): Promise<DocumentMemoryItem | undefined> {
    return this.documents.get(id);
  }

  /**
   * Get all document IDs
   */
  async getIds(): Promise<string[]> {
    return Array.from(this.documents.keys());
  }

  /**
   * Get document count
   */
  getSize(): number {
    return this.documents.size;
  }

  /**
   * Search documents by content
   */
  async searchContent(
    searchTerm: string,
    documentType?: DocumentMemoryItem['documentType'],
    limit = 10
  ): Promise<DocumentMemoryItem[]> {
    const results = Array.from(this.documents.values())
      .filter(doc => {
        const typeMatches = !documentType || doc.documentType === documentType;
        const contentMatches = doc.content.toLowerCase().includes(searchTerm.toLowerCase());
        return typeMatches && contentMatches;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return results;
  }

  /**
   * Get document statistics
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    averageSize: number;
    oldestDocument: Date | null;
    newestDocument: Date | null;
  }> {
    const documents = Array.from(this.documents.values());
    const byType: Record<string, number> = {};
    let totalSize = 0;

    documents.forEach(doc => {
      byType[doc.documentType] = (byType[doc.documentType] || 0) + 1;
      totalSize += doc.content.length;
    });

    const timestamps = documents.map(doc => doc.timestamp);
    const oldestDocument = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null;
    const newestDocument = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null;

    return {
      total: documents.length,
      byType,
      averageSize: documents.length > 0 ? totalSize / documents.length : 0,
      oldestDocument,
      newestDocument,
    };
  }

  /**
   * Determine document type from content
   */
  private determineDocumentType(item: MemoryItem): DocumentMemoryItem['documentType'] {
    const content = item.content.toLowerCase();
    
    if (content.includes('# ') || content.includes('## ') || content.includes('**') || content.includes('*')) {
      return 'markdown';
    }
    
    if (content.includes('<html>') || content.includes('<div>') || content.includes('<p>')) {
      return 'html';
    }
    
    return 'text';
  }

  /**
   * Check if document matches query
   */
  private matchesQuery(doc: DocumentMemoryItem, query: string): boolean {
    const queryLower = query.toLowerCase();
    
    // Search in content
    if (doc.content.toLowerCase().includes(queryLower)) {
      return true;
    }
    
    // Search in metadata
    if (doc.metadata) {
      const metadataString = JSON.stringify(doc.metadata).toLowerCase();
      if (metadataString.includes(queryLower)) {
        return true;
      }
    }
    
    // Search in document structure
    if (doc.documentStructure) {
      const structureString = JSON.stringify(doc.documentStructure).toLowerCase();
      if (structureString.includes(queryLower)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if document matches structure query
   */
  private matchesStructure(doc: DocumentMemoryItem, structureQuery: Partial<DocumentStructure>): boolean {
    if (!doc.documentStructure) {
      return false;
    }
    
    const structure = doc.documentStructure;
    
    // Check title
    if (structureQuery.title && structure.title !== structureQuery.title) {
      return false;
    }
    
    // Check type
    if (structureQuery.type && structure.type !== structureQuery.type) {
      return false;
    }
    
    // Check language
    if (structureQuery.language && structure.language !== structureQuery.language) {
      return false;
    }
    
    // Check word count range
    if (structureQuery.wordCount && structure.wordCount !== structureQuery.wordCount) {
      return false;
    }
    
    return true;
  }
}

/**
 * Document memory factory function
 */
export function createDocumentMemory(): DocumentMemory {
  return new DocumentMemory();
}