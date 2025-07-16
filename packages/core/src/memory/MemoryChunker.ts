/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { MemoryChunker } from './interfaces.js';
import { MemoryChunk, MemoryContentType } from './types.js';

/**
 * Implementation of memory chunking for large content
 */
export class DefaultMemoryChunker implements MemoryChunker {
  private readonly DEFAULT_CHUNK_SIZE = 8192; // 8KB default
  private readonly MIN_CHUNK_SIZE = 1024; // 1KB minimum
  private readonly MAX_CHUNK_SIZE = 65536; // 64KB maximum

  /**
   * Chunk large content into smaller pieces
   */
  async chunk(content: any, maxChunkSize: number = this.DEFAULT_CHUNK_SIZE): Promise<MemoryChunk[]> {
    // Validate chunk size
    const chunkSize = Math.min(Math.max(maxChunkSize, this.MIN_CHUNK_SIZE), this.MAX_CHUNK_SIZE);
    
    // Serialize content to string for chunking
    const serialized = this.serializeContent(content);
    const contentBuffer = Buffer.from(serialized, 'utf8');
    
    // If content is small enough, return single chunk
    if (contentBuffer.length <= chunkSize) {
      return [{
        id: uuidv4(),
        parentId: '', // Will be set by caller
        index: 0,
        totalChunks: 1,
        content: serialized,
        metadata: {
          size: contentBuffer.length,
          checksum: this.generateChecksum(contentBuffer),
          encoding: 'utf8'
        }
      }];
    }

    // Split content into chunks
    const chunks: MemoryChunk[] = [];
    const totalChunks = Math.ceil(contentBuffer.length / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, contentBuffer.length);
      const chunkBuffer = contentBuffer.slice(start, end);
      const chunkContent = chunkBuffer.toString('utf8');
      
      chunks.push({
        id: uuidv4(),
        parentId: '', // Will be set by caller
        index: i,
        totalChunks,
        content: chunkContent,
        metadata: {
          size: chunkBuffer.length,
          checksum: this.generateChecksum(chunkBuffer),
          encoding: 'utf8'
        }
      });
    }

    return chunks;
  }

  /**
   * Reconstruct content from chunks
   */
  async reconstruct(chunks: MemoryChunk[]): Promise<any> {
    if (chunks.length === 0) {
      throw new Error('No chunks provided for reconstruction');
    }

    // Sort chunks by index
    const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);
    
    // Validate chunk sequence
    this.validateChunkSequence(sortedChunks);
    
    // Reconstruct content
    const reconstructedParts: string[] = [];
    
    for (const chunk of sortedChunks) {
      // Verify chunk integrity
      const chunkBuffer = Buffer.from(chunk.content, chunk.metadata.encoding as BufferEncoding);
      const expectedChecksum = chunk.metadata.checksum;
      const actualChecksum = this.generateChecksum(chunkBuffer);
      
      if (expectedChecksum !== actualChecksum) {
        throw new Error(`Chunk ${chunk.index} failed integrity check`);
      }
      
      reconstructedParts.push(chunk.content);
    }
    
    const reconstructed = reconstructedParts.join('');
    
    // Try to deserialize if it looks like structured data
    return this.deserializeContent(reconstructed);
  }

  /**
   * Validate chunk integrity and sequence
   */
  async validateChunks(chunks: MemoryChunk[]): Promise<boolean> {
    try {
      if (chunks.length === 0) {
        return false;
      }

      // Sort chunks by index
      const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);
      
      // Check sequence integrity
      this.validateChunkSequence(sortedChunks);
      
      // Check individual chunk integrity
      for (const chunk of sortedChunks) {
        const chunkBuffer = Buffer.from(chunk.content, chunk.metadata.encoding as BufferEncoding);
        const expectedChecksum = chunk.metadata.checksum;
        const actualChecksum = this.generateChecksum(chunkBuffer);
        
        if (expectedChecksum !== actualChecksum) {
          return false;
        }
      }
      
      return true;
      
    } catch {
      return false;
    }
  }

  /**
   * Chunk content intelligently based on content type
   */
  async intelligentChunk(
    content: any, 
    contentType: MemoryContentType,
    maxChunkSize: number = this.DEFAULT_CHUNK_SIZE
  ): Promise<MemoryChunk[]> {
    switch (contentType) {
      case MemoryContentType.TEXT:
        return this.chunkText(content, maxChunkSize);
        
      case MemoryContentType.CODE:
        return this.chunkCode(content, maxChunkSize);
        
      case MemoryContentType.JSON:
      case MemoryContentType.STRUCTURED:
        return this.chunkStructuredData(content, maxChunkSize);
        
      case MemoryContentType.DOCUMENT:
        return this.chunkDocument(content, maxChunkSize);
        
      default:
        return this.chunk(content, maxChunkSize);
    }
  }

  /**
   * Chunk text content preserving paragraph boundaries
   */
  private async chunkText(text: string, maxChunkSize: number): Promise<MemoryChunk[]> {
    if (!text || text.length <= maxChunkSize) {
      return this.chunk(text, maxChunkSize);
    }

    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: MemoryChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size, finalize current chunk
      if (currentChunk.length + paragraph.length + 2 > maxChunkSize && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk.trim(), chunkIndex, 0)); // totalChunks set later
        currentChunk = paragraph;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk.trim(), chunkIndex, 0));
    }

    // Update total chunks count
    chunks.forEach(chunk => chunk.totalChunks = chunks.length);

    return chunks;
  }

  /**
   * Chunk code content preserving function/class boundaries
   */
  private async chunkCode(code: string, maxChunkSize: number): Promise<MemoryChunk[]> {
    if (!code || code.length <= maxChunkSize) {
      return this.chunk(code, maxChunkSize);
    }

    // Try to split by functions/classes
    const functionMatches = code.match(/(function\s+\w+|class\s+\w+|const\s+\w+\s*=|\w+\s*:\s*function)/g);
    
    if (!functionMatches || functionMatches.length < 2) {
      // Fallback to line-based chunking
      return this.chunkByLines(code, maxChunkSize);
    }

    // Implementation would be more complex for proper code parsing
    // For now, fallback to line-based chunking
    return this.chunkByLines(code, maxChunkSize);
  }

  /**
   * Chunk structured data by preserving object boundaries
   */
  private async chunkStructuredData(data: any, maxChunkSize: number): Promise<MemoryChunk[]> {
    const serialized = JSON.stringify(data, null, 2);
    
    if (serialized.length <= maxChunkSize) {
      return this.chunk(data, maxChunkSize);
    }

    // If it's an array, chunk by array elements
    if (Array.isArray(data)) {
      return this.chunkArray(data, maxChunkSize);
    }

    // If it's an object, chunk by top-level properties
    if (typeof data === 'object' && data !== null) {
      return this.chunkObject(data, maxChunkSize);
    }

    // Fallback to regular chunking
    return this.chunk(data, maxChunkSize);
  }

  /**
   * Chunk document content preserving structure
   */
  private async chunkDocument(document: any, maxChunkSize: number): Promise<MemoryChunk[]> {
    if (typeof document === 'string') {
      return this.chunkText(document, maxChunkSize);
    }

    if (typeof document === 'object' && document.content) {
      // Document with metadata
      const contentChunks = await this.chunkText(document.content, maxChunkSize);
      
      // Add document metadata to first chunk
      if (contentChunks.length > 0) {
        const metadata = { ...document };
        delete metadata.content;
        contentChunks[0].content = {
          metadata,
          content: contentChunks[0].content
        };
      }
      
      return contentChunks;
    }

    return this.chunk(document, maxChunkSize);
  }

  /**
   * Chunk content by lines
   */
  private async chunkByLines(text: string, maxChunkSize: number): Promise<MemoryChunk[]> {
    const lines = text.split('\n');
    const chunks: MemoryChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk.trim(), chunkIndex, 0));
        currentChunk = line;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk.trim(), chunkIndex, 0));
    }

    chunks.forEach(chunk => chunk.totalChunks = chunks.length);
    return chunks;
  }

  /**
   * Chunk array by elements
   */
  private async chunkArray(array: any[], maxChunkSize: number): Promise<MemoryChunk[]> {
    const chunks: MemoryChunk[] = [];
    let currentChunk: any[] = [];
    let chunkIndex = 0;

    for (const item of array) {
      const itemSize = JSON.stringify(item).length;
      const currentSize = JSON.stringify(currentChunk).length;

      if (currentSize + itemSize > maxChunkSize && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk, chunkIndex, 0));
        currentChunk = [item];
        chunkIndex++;
      } else {
        currentChunk.push(item);
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, 0));
    }

    chunks.forEach(chunk => chunk.totalChunks = chunks.length);
    return chunks;
  }

  /**
   * Chunk object by properties
   */
  private async chunkObject(obj: Record<string, any>, maxChunkSize: number): Promise<MemoryChunk[]> {
    const chunks: MemoryChunk[] = [];
    let currentChunk: Record<string, any> = {};
    let chunkIndex = 0;

    for (const [key, value] of Object.entries(obj)) {
      const propertySize = JSON.stringify({ [key]: value }).length;
      const currentSize = JSON.stringify(currentChunk).length;

      if (currentSize + propertySize > maxChunkSize && Object.keys(currentChunk).length > 0) {
        chunks.push(this.createChunk(currentChunk, chunkIndex, 0));
        currentChunk = { [key]: value };
        chunkIndex++;
      } else {
        currentChunk[key] = value;
      }
    }

    if (Object.keys(currentChunk).length > 0) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, 0));
    }

    chunks.forEach(chunk => chunk.totalChunks = chunks.length);
    return chunks;
  }

  /**
   * Create a memory chunk
   */
  private createChunk(content: any, index: number, totalChunks: number): MemoryChunk {
    const serialized = typeof content === 'string' ? content : JSON.stringify(content);
    const buffer = Buffer.from(serialized, 'utf8');

    return {
      id: uuidv4(),
      parentId: '',
      index,
      totalChunks,
      content: serialized,
      metadata: {
        size: buffer.length,
        checksum: this.generateChecksum(buffer),
        encoding: 'utf8'
      }
    };
  }

  /**
   * Validate chunk sequence integrity
   */
  private validateChunkSequence(chunks: MemoryChunk[]): void {
    if (chunks.length === 0) {
      throw new Error('No chunks to validate');
    }

    const totalChunks = chunks[0].totalChunks;
    
    // Check if all chunks have same totalChunks
    if (!chunks.every(chunk => chunk.totalChunks === totalChunks)) {
      throw new Error('Inconsistent totalChunks across chunks');
    }

    // Check if we have all expected chunks
    if (chunks.length !== totalChunks) {
      throw new Error(`Expected ${totalChunks} chunks, got ${chunks.length}`);
    }

    // Check if indices are sequential
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].index !== i) {
        throw new Error(`Missing or duplicate chunk at index ${i}`);
      }
    }

    // Check if all chunks have same parentId
    const parentId = chunks[0].parentId;
    if (!chunks.every(chunk => chunk.parentId === parentId)) {
      throw new Error('Chunks have different parent IDs');
    }
  }

  /**
   * Serialize content to string
   */
  private serializeContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    return JSON.stringify(content);
  }

  /**
   * Deserialize content from string
   */
  private deserializeContent(serialized: string): any {
    try {
      return JSON.parse(serialized);
    } catch {
      return serialized;
    }
  }

  /**
   * Generate checksum for data
   */
  private generateChecksum(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Get chunking statistics
   */
  getChunkingStats(content: any): {
    contentSize: number;
    estimatedChunks: number;
    recommendedChunkSize: number;
    chunkingStrategy: string;
  } {
    const serialized = this.serializeContent(content);
    const contentSize = Buffer.byteLength(serialized, 'utf8');
    
    let recommendedChunkSize = this.DEFAULT_CHUNK_SIZE;
    let chunkingStrategy = 'default';

    // Adjust chunk size based on content size
    if (contentSize > 100000) { // > 100KB
      recommendedChunkSize = this.MAX_CHUNK_SIZE;
      chunkingStrategy = 'large';
    } else if (contentSize < 5000) { // < 5KB
      recommendedChunkSize = Math.max(this.MIN_CHUNK_SIZE, contentSize);
      chunkingStrategy = 'small';
    }

    const estimatedChunks = Math.ceil(contentSize / recommendedChunkSize);

    return {
      contentSize,
      estimatedChunks,
      recommendedChunkSize,
      chunkingStrategy
    };
  }
}