/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DocumentMemoryItem,
  DocumentStructure,
  DocumentSection,
  DocumentMetadata,
  HeadingInfo,
  LinkInfo,
  ImageInfo,
  TableInfo,
  CodeBlockInfo,
  ListItemInfo,
} from './DocumentMemory.js';

/**
 * Document processor for analyzing and extracting structure from markdown documents
 */
export class DocumentProcessor {
  /**
   * Process a markdown document and extract its structure
   */
  async processMarkdownDocument(
    content: string,
    filename?: string
  ): Promise<DocumentMemoryItem> {
    const structure = await this.extractMarkdownStructure(content);
    const parseResult = await this.parseMarkdownElements(content);
    
    return {
      content,
      timestamp: new Date(),
      documentType: 'markdown',
      documentStructure: structure,
      fileInfo: filename ? {
        filename,
        size: content.length,
        lastModified: new Date(),
        encoding: 'utf-8',
      } : undefined,
      parseResult,
      metadata: {
        wordCount: this.countWords(content),
        readingTime: this.estimateReadingTime(content),
      },
    };
  }

  /**
   * Extract structure from markdown content
   */
  private async extractMarkdownStructure(content: string): Promise<DocumentStructure> {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    let currentSection: DocumentSection | null = null;
    let sectionId = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];
        
        const section: DocumentSection = {
          id: `section-${sectionId++}`,
          type: 'heading',
          level,
          title,
          content: line,
          children: [],
          lineNumber: i + 1,
        };

        sections.push(section);
        currentSection = section;
        continue;
      }

      // Check for other elements
      if (line.startsWith('```')) {
        const codeSection: DocumentSection = {
          id: `section-${sectionId++}`,
          type: 'code',
          content: this.extractCodeBlock(lines, i),
          lineNumber: i + 1,
        };
        sections.push(codeSection);
        currentSection = codeSection;
        continue;
      }

      if (line.startsWith('|') && line.includes('|')) {
        const tableSection: DocumentSection = {
          id: `section-${sectionId++}`,
          type: 'table',
          content: this.extractTable(lines, i),
          lineNumber: i + 1,
        };
        sections.push(tableSection);
        currentSection = tableSection;
        continue;
      }

      if (line.startsWith('![') || line.startsWith('![')) {
        const imageSection: DocumentSection = {
          id: `section-${sectionId++}`,
          type: 'image',
          content: line,
          lineNumber: i + 1,
        };
        sections.push(imageSection);
        currentSection = imageSection;
        continue;
      }

      if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\.\s/)) {
        const listSection: DocumentSection = {
          id: `section-${sectionId++}`,
          type: 'list',
          content: this.extractList(lines, i),
          lineNumber: i + 1,
        };
        sections.push(listSection);
        currentSection = listSection;
        continue;
      }

      if (line.startsWith('>')) {
        const quoteSection: DocumentSection = {
          id: `section-${sectionId++}`,
          type: 'quote',
          content: this.extractQuote(lines, i),
          lineNumber: i + 1,
        };
        sections.push(quoteSection);
        currentSection = quoteSection;
        continue;
      }

      // Regular paragraph
      if (line.length > 0 && !this.isSpecialLine(line)) {
        const paragraphSection: DocumentSection = {
          id: `section-${sectionId++}`,
          type: 'paragraph',
          content: line,
          lineNumber: i + 1,
        };
        sections.push(paragraphSection);
        currentSection = paragraphSection;
      }
    }

    const title = this.extractTitle(content);
    const metadata = this.extractMetadata(content);

    return {
      type: 'document',
      title,
      sections,
      wordCount: this.countWords(content),
      readingTime: this.estimateReadingTime(content),
      language: this.detectLanguage(content),
      metadata,
    };
  }

  /**
   * Parse markdown elements
   */
  private async parseMarkdownElements(content: string): Promise<DocumentMemoryItem['parseResult']> {
    const lines = content.split('\n');
    const headings: HeadingInfo[] = [];
    const links: LinkInfo[] = [];
    const images: ImageInfo[] = [];
    const tables: TableInfo[] = [];
    const codeBlocks: CodeBlockInfo[] = [];
    const listItems: ListItemInfo[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        headings.push({
          level: headingMatch[1].length,
          text: headingMatch[2],
          lineNumber: i + 1,
          anchor: this.generateAnchor(headingMatch[2]),
        });
      }

      // Extract links
      const linkMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      for (const match of linkMatches) {
        links.push({
          text: match[1],
          url: match[2],
          type: this.getLinkType(match[2]),
          lineNumber: i + 1,
        });
      }

      // Extract images
      const imageMatches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
      for (const match of imageMatches) {
        images.push({
          src: match[2],
          alt: match[1],
          lineNumber: i + 1,
        });
      }

      // Extract list items
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        const indent = listMatch[1];
        const marker = listMatch[2];
        const text = listMatch[3];
        const isOrdered = /^\d+\./.test(marker);
        const level = Math.floor(indent.length / 2);

        listItems.push({
          type: isOrdered ? 'ordered' : 'unordered',
          level,
          text,
          lineNumber: i + 1,
          checked: text.startsWith('[ ]') || text.startsWith('[x]') ? text.startsWith('[x]') : undefined,
        });
      }

      // Extract code blocks
      if (line.startsWith('```')) {
        const language = line.substring(3).trim();
        const codeLines: string[] = [];
        let j = i + 1;
        
        while (j < lines.length && !lines[j].startsWith('```')) {
          codeLines.push(lines[j]);
          j++;
        }

        if (j < lines.length) {
          codeBlocks.push({
            language: language || undefined,
            code: codeLines.join('\n'),
            lineNumber: i + 1,
          });
        }
      }

      // Extract tables
      if (line.includes('|') && line.trim().startsWith('|')) {
        const tableData = this.parseTableData(lines, i);
        if (tableData) {
          tables.push({
            headers: tableData.headers,
            rows: tableData.rows,
            lineNumber: i + 1,
          });
        }
      }
    }

    return {
      headings,
      links,
      images,
      tables,
      codeBlocks,
      listItems,
    };
  }

  /**
   * Extract code block content
   */
  private extractCodeBlock(lines: string[], startIndex: number): string {
    const codeLines: string[] = [];
    let i = startIndex + 1;
    
    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    
    return codeLines.join('\n');
  }

  /**
   * Extract table content
   */
  private extractTable(lines: string[], startIndex: number): string {
    const tableLines: string[] = [];
    let i = startIndex;
    
    while (i < lines.length && lines[i].includes('|')) {
      tableLines.push(lines[i]);
      i++;
    }
    
    return tableLines.join('\n');
  }

  /**
   * Extract list content
   */
  private extractList(lines: string[], startIndex: number): string {
    const listLines: string[] = [];
    let i = startIndex;
    
    while (i < lines.length && (lines[i].match(/^\s*[-*+]/) || lines[i].match(/^\s*\d+\./) || lines[i].trim() === '')) {
      listLines.push(lines[i]);
      i++;
    }
    
    return listLines.join('\n');
  }

  /**
   * Extract quote content
   */
  private extractQuote(lines: string[], startIndex: number): string {
    const quoteLines: string[] = [];
    let i = startIndex;
    
    while (i < lines.length && lines[i].startsWith('>')) {
      quoteLines.push(lines[i]);
      i++;
    }
    
    return quoteLines.join('\n');
  }

  /**
   * Parse table data
   */
  private parseTableData(lines: string[], startIndex: number): { headers: string[]; rows: string[][] } | null {
    if (startIndex >= lines.length) return null;
    
    const headerLine = lines[startIndex];
    const headers = headerLine.split('|').map(h => h.trim()).filter(h => h.length > 0);
    
    // Skip separator line
    let i = startIndex + 1;
    if (i < lines.length && lines[i].includes('---')) {
      i++;
    }
    
    const rows: string[][] = [];
    while (i < lines.length && lines[i].includes('|')) {
      const row = lines[i].split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
      if (row.length > 0) {
        rows.push(row);
      }
      i++;
    }
    
    return { headers, rows };
  }

  /**
   * Extract document title
   */
  private extractTitle(content: string): string | undefined {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const headingMatch = line.match(/^#\s+(.+)$/);
      if (headingMatch) {
        return headingMatch[1];
      }
    }
    
    return undefined;
  }

  /**
   * Extract metadata from front matter
   */
  private extractMetadata(content: string): DocumentMetadata {
    const metadata: DocumentMetadata = {};
    
    // Check for YAML front matter
    if (content.startsWith('---\n')) {
      const endIndex = content.indexOf('\n---\n', 4);
      if (endIndex !== -1) {
        const frontMatter = content.substring(4, endIndex);
        try {
          // Simple YAML parsing for common cases
          const lines = frontMatter.split('\n');
          const frontMatterData: Record<string, any> = {};
          
          for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
              const key = line.substring(0, colonIndex).trim();
              const value = line.substring(colonIndex + 1).trim();
              frontMatterData[key] = value;
            }
          }
          
          metadata.frontMatter = frontMatterData;
          metadata.title = frontMatterData.title;
          metadata.author = frontMatterData.author;
          metadata.description = frontMatterData.description;
          metadata.tags = frontMatterData.tags ? frontMatterData.tags.split(',').map((t: string) => t.trim()) : undefined;
        } catch (error) {
          // Ignore parsing errors
        }
      }
    }
    
    return metadata;
  }

  /**
   * Generate anchor for heading
   */
  private generateAnchor(text: string): string {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Determine link type
   */
  private getLinkType(url: string): LinkInfo['type'] {
    if (url.startsWith('#')) return 'anchor';
    if (url.startsWith('http://') || url.startsWith('https://')) return 'external';
    return 'internal';
  }

  /**
   * Check if line is special (not a regular paragraph)
   */
  private isSpecialLine(line: string): boolean {
    return line.startsWith('#') ||
           line.startsWith('```') ||
           line.startsWith('|') ||
           line.startsWith('![') ||
           line.startsWith('- ') ||
           line.startsWith('* ') ||
           line.startsWith('> ') ||
           line.match(/^\d+\.\s/) !== null;
  }

  /**
   * Count words in content
   */
  private countWords(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Estimate reading time in minutes
   */
  private estimateReadingTime(content: string): number {
    const wordsPerMinute = 200; // Average reading speed
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Detect document language (basic implementation)
   */
  private detectLanguage(content: string): string {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'is', 'to', 'in', 'of', 'for', 'with', 'on', 'at'];
    const words = content.toLowerCase().split(/\s+/);
    
    let englishCount = 0;
    for (const word of words) {
      if (englishWords.includes(word)) {
        englishCount++;
      }
    }
    
    const englishRatio = englishCount / words.length;
    
    if (englishRatio > 0.1) {
      return 'en';
    }
    
    return 'unknown';
  }
}

/**
 * Create a document processor instance
 */
export function createDocumentProcessor(): DocumentProcessor {
  return new DocumentProcessor();
}