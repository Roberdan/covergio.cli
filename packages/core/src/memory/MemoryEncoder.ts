/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { MemoryEncoder } from './interfaces.js';
import { MemoryContentType } from './types.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Implementation of memory encoding and compression
 */
export class DefaultMemoryEncoder implements MemoryEncoder {
  private readonly compressionLevel = 6; // Balanced compression level

  /**
   * Encode content for storage
   */
  async encode(content: any, contentType: string): Promise<Buffer> {
    try {
      let serialized: string;

      switch (contentType) {
        case MemoryContentType.TEXT:
          serialized = typeof content === 'string' ? content : String(content);
          break;

        case MemoryContentType.JSON:
        case MemoryContentType.STRUCTURED:
          serialized = JSON.stringify(content, null, 0);
          break;

        case MemoryContentType.CODE:
          serialized = typeof content === 'string' ? content : String(content);
          break;

        case MemoryContentType.DOCUMENT:
          if (typeof content === 'object' && content.content) {
            serialized = JSON.stringify(content);
          } else {
            serialized = String(content);
          }
          break;

        case MemoryContentType.IMAGE:
        case MemoryContentType.AUDIO:
        case MemoryContentType.VIDEO:
          // For binary content, assume it's already a buffer or base64
          if (Buffer.isBuffer(content)) {
            return content;
          } else if (typeof content === 'string') {
            // Assume base64 encoded
            return Buffer.from(content, 'base64');
          } else {
            // Store metadata about the binary content
            serialized = JSON.stringify({
              type: contentType,
              metadata: content,
              encoding: 'json'
            });
          }
          break;

        default:
          // Default to JSON serialization
          serialized = JSON.stringify(content);
      }

      // Convert to buffer if we have a string
      if (typeof serialized === 'string') {
        return Buffer.from(serialized, 'utf8');
      }

      return serialized as Buffer;

    } catch (error) {
      throw new Error(`Failed to encode content: ${(error as Error).message}`);
    }
  }

  /**
   * Decode content from storage
   */
  async decode(data: Buffer, contentType: string): Promise<any> {
    try {
      const stringData = data.toString('utf8');

      switch (contentType) {
        case MemoryContentType.TEXT:
        case MemoryContentType.CODE:
          return stringData;

        case MemoryContentType.JSON:
        case MemoryContentType.STRUCTURED:
        case MemoryContentType.DOCUMENT:
          try {
            return JSON.parse(stringData);
          } catch {
            // If JSON parsing fails, return as string
            return stringData;
          }

        case MemoryContentType.IMAGE:
        case MemoryContentType.AUDIO:
        case MemoryContentType.VIDEO:
          // Try to parse as JSON first (metadata)
          try {
            const parsed = JSON.parse(stringData);
            if (parsed.type === contentType && parsed.encoding === 'json') {
              return parsed.metadata;
            }
          } catch {
            // If not JSON, return as buffer (binary content)
            return data;
          }
          return data;

        default:
          // Try JSON first, fallback to string
          try {
            return JSON.parse(stringData);
          } catch {
            return stringData;
          }
      }

    } catch (error) {
      throw new Error(`Failed to decode content: ${(error as Error).message}`);
    }
  }

  /**
   * Compress encoded data
   */
  async compress(data: Buffer): Promise<Buffer> {
    try {
      // Only compress if data is large enough to benefit
      if (data.length < 100) {
        return data;
      }

      const compressed = await gzipAsync(data, { level: this.compressionLevel });
      
      // Only return compressed version if it's actually smaller
      return compressed.length < data.length ? compressed : data;

    } catch (error) {
      throw new Error(`Failed to compress data: ${(error as Error).message}`);
    }
  }

  /**
   * Decompress data
   */
  async decompress(data: Buffer): Promise<Buffer> {
    try {
      // Check if data is gzip compressed (magic bytes: 1f 8b)
      if (data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b) {
        return await gunzipAsync(data);
      }
      
      // Data is not compressed
      return data;

    } catch (error) {
      throw new Error(`Failed to decompress data: ${(error as Error).message}`);
    }
  }

  /**
   * Generate checksum for data integrity
   */
  checksum(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify data integrity using checksum
   */
  verifyChecksum(data: Buffer, expectedChecksum: string): boolean {
    const actualChecksum = this.checksum(data);
    return actualChecksum === expectedChecksum;
  }

  /**
   * Encode and compress content in one operation
   */
  async encodeAndCompress(content: any, contentType: string): Promise<{
    data: Buffer;
    checksum: string;
    compressed: boolean;
    originalSize: number;
    compressedSize: number;
  }> {
    const encoded = await this.encode(content, contentType);
    const originalSize = encoded.length;
    
    const compressed = await this.compress(encoded);
    const isCompressed = compressed.length < encoded.length;
    
    const checksum = this.checksum(isCompressed ? compressed : encoded);

    return {
      data: isCompressed ? compressed : encoded,
      checksum,
      compressed: isCompressed,
      originalSize,
      compressedSize: compressed.length
    };
  }

  /**
   * Decompress and decode content in one operation
   */
  async decompressAndDecode(
    data: Buffer, 
    contentType: string, 
    isCompressed: boolean = false
  ): Promise<any> {
    let processedData = data;
    
    if (isCompressed) {
      processedData = await this.decompress(data);
    }
    
    return await this.decode(processedData, contentType);
  }

  /**
   * Get encoding statistics
   */
  getEncodingStats(content: any, contentType: string): {
    estimatedSize: number;
    complexity: 'low' | 'medium' | 'high';
    recommendCompression: boolean;
  } {
    let estimatedSize: number;
    let complexity: 'low' | 'medium' | 'high';

    switch (contentType) {
      case MemoryContentType.TEXT:
      case MemoryContentType.CODE:
        estimatedSize = typeof content === 'string' ? 
          Buffer.byteLength(content, 'utf8') : 
          Buffer.byteLength(String(content), 'utf8');
        complexity = estimatedSize > 10000 ? 'high' : estimatedSize > 1000 ? 'medium' : 'low';
        break;

      case MemoryContentType.JSON:
      case MemoryContentType.STRUCTURED:
        const jsonString = JSON.stringify(content);
        estimatedSize = Buffer.byteLength(jsonString, 'utf8');
        complexity = Object.keys(content || {}).length > 50 ? 'high' : 
                    Object.keys(content || {}).length > 10 ? 'medium' : 'low';
        break;

      case MemoryContentType.IMAGE:
      case MemoryContentType.AUDIO:
      case MemoryContentType.VIDEO:
        if (Buffer.isBuffer(content)) {
          estimatedSize = content.length;
        } else if (typeof content === 'string') {
          estimatedSize = Buffer.byteLength(content, 'base64');
        } else {
          estimatedSize = Buffer.byteLength(JSON.stringify(content), 'utf8');
        }
        complexity = estimatedSize > 1000000 ? 'high' : estimatedSize > 100000 ? 'medium' : 'low';
        break;

      default:
        const defaultString = JSON.stringify(content);
        estimatedSize = Buffer.byteLength(defaultString, 'utf8');
        complexity = 'medium';
    }

    return {
      estimatedSize,
      complexity,
      recommendCompression: estimatedSize > 1000 // Recommend compression for > 1KB
    };
  }

  /**
   * Validate content type detection
   */
  validateContentType(content: any, declaredType: string): {
    isValid: boolean;
    detectedType: string;
    confidence: number;
  } {
    let detectedType = MemoryContentType.STRUCTURED;
    let confidence = 0.5;

    if (typeof content === 'string') {
      // Check for code patterns
      if (this.looksLikeCode(content)) {
        detectedType = MemoryContentType.CODE;
        confidence = 0.8;
      } else {
        detectedType = MemoryContentType.TEXT;
        confidence = 0.9;
      }
    } else if (Buffer.isBuffer(content)) {
      // Binary content
      detectedType = MemoryContentType.IMAGE; // Default binary type
      confidence = 0.6;
    } else if (typeof content === 'object' && content !== null) {
      detectedType = MemoryContentType.JSON;
      confidence = 0.9;
    }

    return {
      isValid: detectedType === declaredType,
      detectedType,
      confidence
    };
  }

  /**
   * Simple heuristic to detect if text looks like code
   */
  private looksLikeCode(text: string): boolean {
    const codeIndicators = [
      'function', 'class', 'import', 'export', 'const', 'let', 'var',
      'if (', 'for (', 'while (', '=>', '{', '}', ';', '//', '/*'
    ];

    const matches = codeIndicators.filter(indicator => 
      text.toLowerCase().includes(indicator.toLowerCase())
    ).length;

    return matches >= 3; // If 3+ indicators, likely code
  }
}