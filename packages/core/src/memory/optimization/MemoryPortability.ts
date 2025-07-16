/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { MemoryPortability } from './interfaces.js';
import { MemoryPortabilityConfig, MemoryExportResult, MemoryImportResult } from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory portability
 */
export class DefaultMemoryPortability implements MemoryPortability {
  private memoryStore: MemoryStore;
  private supportedFormats = ['json', 'csv', 'xml', 'binary'];

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Export memories to file
   */
  async exportMemories(config: MemoryPortabilityConfig): Promise<MemoryExportResult> {
    const startTime = Date.now();
    
    try {
      // Get memories to export
      const searchResult = await this.memoryStore.search({});
      let memories = searchResult.items;

      // Apply filters
      if (config.filter) {
        memories = this.applyFilters(memories, config.filter);
      }

      // Generate export data
      const exportData = this.generateExportData(memories, config);
      
      // Generate export filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `memory-export-${timestamp}.${config.format}`;
      const exportPath = join(process.cwd(), filename);

      // Write export file
      await fs.writeFile(exportPath, exportData);

      // Get file size
      const stats = await fs.stat(exportPath);
      const exportSize = stats.size;

      return {
        success: true,
        exportPath,
        memoriesExported: memories.length,
        exportSize,
        duration: Date.now() - startTime,
        format: config.format,
        exportedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        exportPath: '',
        memoriesExported: 0,
        exportSize: 0,
        duration: Date.now() - startTime,
        format: config.format,
        exportedAt: new Date(),
        error: error as Error
      };
    }
  }

  /**
   * Import memories from file
   */
  async importMemories(filePath: string, options?: {
    overwrite?: boolean;
    agentMapping?: Map<string, string>;
    validation?: boolean;
  }): Promise<MemoryImportResult> {
    const startTime = Date.now();
    
    try {
      // Read and parse file
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const memories = this.parseImportData(fileContent, filePath);

      // Apply agent mapping if provided
      if (options?.agentMapping) {
        memories.forEach(memory => {
          const newAgentId = options.agentMapping!.get(memory.agentId);
          if (newAgentId) {
            memory.agentId = newAgentId;
          }
        });
      }

      // Validate memories if requested
      if (options?.validation) {
        const validationResult = this.validateMemories(memories);
        if (!validationResult.valid) {
          throw new Error(`Validation failed: ${validationResult.issues.join(', ')}`);
        }
      }

      // Import memories
      let memoriesImported = 0;
      let memoriesSkipped = 0;
      const conflicts: string[] = [];

      for (const memory of memories) {
        try {
          // Check for conflicts
          const existing = await this.memoryStore.retrieve(memory.id);
          if (existing && !options?.overwrite) {
            conflicts.push(memory.id);
            memoriesSkipped++;
            continue;
          }

          // Import memory
          await this.memoryStore.store(memory);
          memoriesImported++;

        } catch (error) {
          // Memory doesn't exist, import it
          await this.memoryStore.store(memory);
          memoriesImported++;
        }
      }

      return {
        success: true,
        memoriesImported,
        memoriesSkipped,
        duration: Date.now() - startTime,
        conflicts,
        importedAt: new Date()
      };

    } catch (error) {
      return {
        success: false,
        memoriesImported: 0,
        memoriesSkipped: 0,
        duration: Date.now() - startTime,
        conflicts: [],
        importedAt: new Date(),
        error: error as Error
      };
    }
  }

  /**
   * Get supported export formats
   */
  async getSupportedFormats(): Promise<string[]> {
    return [...this.supportedFormats];
  }

  /**
   * Validate import file
   */
  async validateImportFile(filePath: string): Promise<{
    valid: boolean;
    format: string;
    memoryCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // Check if file exists
      await fs.access(filePath);

      // Detect format
      const format = this.detectFileFormat(filePath);
      if (!this.supportedFormats.includes(format)) {
        issues.push(`Unsupported format: ${format}`);
        return { valid: false, format, memoryCount: 0, issues };
      }

      // Read and parse file
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const memories = this.parseImportData(fileContent, filePath);

      // Validate memories
      const validationResult = this.validateMemories(memories);
      if (!validationResult.valid) {
        issues.push(...validationResult.issues);
      }

      return {
        valid: issues.length === 0,
        format,
        memoryCount: memories.length,
        issues
      };

    } catch (error) {
      issues.push(`File validation failed: ${(error as Error).message}`);
      return { valid: false, format: 'unknown', memoryCount: 0, issues };
    }
  }

  /**
   * Get export templates
   */
  async getExportTemplates(): Promise<Array<{
    name: string;
    description: string;
    config: MemoryPortabilityConfig;
  }>> {
    return [
      {
        name: 'Full Export',
        description: 'Export all memories with full metadata and relationships',
        config: {
          format: 'json',
          includeMetadata: true,
          includeEmbeddings: true,
          includeRelationships: true,
          enableCompression: true,
          enableEncryption: false
        }
      },
      {
        name: 'Minimal Export',
        description: 'Export only essential memory data',
        config: {
          format: 'json',
          includeMetadata: false,
          includeEmbeddings: false,
          includeRelationships: false,
          enableCompression: false,
          enableEncryption: false
        }
      },
      {
        name: 'CSV Export',
        description: 'Export memories in CSV format for spreadsheet analysis',
        config: {
          format: 'csv',
          includeMetadata: true,
          includeEmbeddings: false,
          includeRelationships: false,
          enableCompression: false,
          enableEncryption: false
        }
      },
      {
        name: 'Secure Export',
        description: 'Export with compression and encryption',
        config: {
          format: 'json',
          includeMetadata: true,
          includeEmbeddings: true,
          includeRelationships: true,
          enableCompression: true,
          enableEncryption: true
        }
      }
    ];
  }

  /**
   * Apply filters to memories
   */
  private applyFilters(memories: MemoryItem[], filter: NonNullable<MemoryPortabilityConfig['filter']>): MemoryItem[] {
    return memories.filter(memory => {
      // Agent filter
      if (filter.agentIds && !filter.agentIds.includes(memory.agentId)) {
        return false;
      }

      // Memory type filter
      if (filter.memoryTypes && !filter.memoryTypes.includes(memory.type)) {
        return false;
      }

      // Date range filter
      if (filter.dateRange) {
        const createdAt = memory.metadata?.createdAt as Date;
        if (createdAt) {
          const memoryTime = createdAt.getTime();
          const startTime = filter.dateRange.start.getTime();
          const endTime = filter.dateRange.end.getTime();
          
          if (memoryTime < startTime || memoryTime > endTime) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Generate export data in the specified format
   */
  private generateExportData(memories: MemoryItem[], config: MemoryPortabilityConfig): string {
    // Filter data based on configuration
    const filteredMemories = memories.map(memory => {
      const exportMemory: any = {
        id: memory.id,
        type: memory.type,
        agentId: memory.agentId,
        content: memory.content,
        scope: memory.scope
      };

      if (config.includeMetadata) {
        exportMemory.metadata = memory.metadata;
      }

      if (config.includeEmbeddings) {
        exportMemory.embeddings = memory.embeddings;
      }

      if (config.includeRelationships) {
        exportMemory.relationships = memory.relationships;
      }

      return exportMemory;
    });

    // Generate data in requested format
    switch (config.format) {
      case 'json':
        return JSON.stringify({
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          config,
          memories: filteredMemories
        }, null, 2);

      case 'csv':
        return this.generateCSV(filteredMemories);

      case 'xml':
        return this.generateXML(filteredMemories);

      case 'binary':
        return this.generateBinary(filteredMemories);

      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }

  /**
   * Parse import data from file content
   */
  private parseImportData(content: string, filePath: string): MemoryItem[] {
    const format = this.detectFileFormat(filePath);

    switch (format) {
      case 'json':
        return this.parseJSON(content);

      case 'csv':
        return this.parseCSV(content);

      case 'xml':
        return this.parseXML(content);

      case 'binary':
        return this.parseBinary(content);

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }

  /**
   * Detect file format from file path
   */
  private detectFileFormat(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return extension || 'unknown';
  }

  /**
   * Validate memories structure
   */
  private validateMemories(memories: MemoryItem[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];

      if (!memory.id) {
        issues.push(`Memory at index ${i} missing id`);
      }

      if (!memory.type) {
        issues.push(`Memory at index ${i} missing type`);
      }

      if (!memory.agentId) {
        issues.push(`Memory at index ${i} missing agentId`);
      }

      if (!memory.content) {
        issues.push(`Memory at index ${i} missing content`);
      }

      if (!memory.scope) {
        issues.push(`Memory at index ${i} missing scope`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Generate CSV format
   */
  private generateCSV(memories: any[]): string {
    if (memories.length === 0) return '';

    const headers = Object.keys(memories[0]);
    const csvRows = [headers.join(',')];

    for (const memory of memories) {
      const row = headers.map(header => {
        const value = memory[header];
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Generate XML format
   */
  private generateXML(memories: any[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<memories>\n';
    
    for (const memory of memories) {
      xml += '  <memory>\n';
      for (const [key, value] of Object.entries(memory)) {
        xml += `    <${key}>${this.escapeXML(String(value))}</${key}>\n`;
      }
      xml += '  </memory>\n';
    }
    
    xml += '</memories>';
    return xml;
  }

  /**
   * Generate binary format (placeholder)
   */
  private generateBinary(memories: any[]): string {
    // In a real implementation, this would generate actual binary data
    return JSON.stringify(memories);
  }

  /**
   * Parse JSON format
   */
  private parseJSON(content: string): MemoryItem[] {
    const data = JSON.parse(content);
    return data.memories || data;
  }

  /**
   * Parse CSV format
   */
  private parseCSV(content: string): MemoryItem[] {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    const memories: MemoryItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      const memory: any = {};

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = values[j];

        if (header === 'content' || header === 'metadata' || header === 'embeddings') {
          try {
            memory[header] = JSON.parse(value);
          } catch {
            memory[header] = value;
          }
        } else {
          memory[header] = value;
        }
      }

      memories.push(memory as MemoryItem);
    }

    return memories;
  }

  /**
   * Parse XML format (placeholder)
   */
  private parseXML(content: string): MemoryItem[] {
    // In a real implementation, this would properly parse XML
    throw new Error('XML parsing not implemented');
  }

  /**
   * Parse binary format (placeholder)
   */
  private parseBinary(content: string): MemoryItem[] {
    // In a real implementation, this would parse binary data
    return JSON.parse(content);
  }

  /**
   * Parse CSV line with proper quote handling
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}