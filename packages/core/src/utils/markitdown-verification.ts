/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarkItDown } from 'markitdown-ts';

/**
 * Verification utility for the MarkItDown library integration
 * This ensures the library is properly installed and functional
 */
export class MarkItDownVerification {
  /**
   * Verify that the MarkItDown library is properly installed and functional
   */
  static async verify(): Promise<{
    success: boolean;
    message: string;
    version?: string;
    capabilities?: string[];
  }> {
    try {
      // Test basic initialization
      const markitdown = new MarkItDown();
      
      // Check if convert method is available
      if (typeof markitdown.convert !== 'function') {
        return {
          success: false,
          message: 'MarkItDown library missing convert method'
        };
      }
      
      // Test basic conversion capability
      const testResult = await MarkItDownVerification.testBasicConversion();
      if (!testResult.success) {
        return testResult;
      }
      
      return {
        success: true,
        message: 'MarkItDown library is properly installed and functional',
        version: '0.0.4', // markitdown-ts version
        capabilities: [
          'markdown-parsing',
          'document-conversion',
          'file-processing',
          'text-extraction',
          'structure-analysis'
        ]
      };
      
    } catch (error) {
      return {
        success: false,
        message: `MarkItDown verification failed: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Test basic conversion functionality
   */
  private static async testBasicConversion(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const { writeFileSync, unlinkSync } = await import('fs');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      
      // Create a temporary test file
      const testFile = join(tmpdir(), `markitdown-test-${Date.now()}.md`);
      const testContent = `# Test Document\n\nThis is a test for MarkItDown verification.`;
      
      writeFileSync(testFile, testContent);
      
      // Test conversion
      const markitdown = new MarkItDown();
      const result = await markitdown.convert(testFile);
      
      // Clean up
      unlinkSync(testFile);
      
      if (!result || !result.text_content) {
        return {
          success: false,
          message: 'MarkItDown conversion returned empty result'
        };
      }
      
      // Verify the content was processed correctly
      if (!result.text_content.includes('Test Document')) {
        return {
          success: false,
          message: 'MarkItDown conversion did not preserve content correctly'
        };
      }
      
      return {
        success: true,
        message: 'Basic conversion test passed'
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Basic conversion test failed: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Get information about supported file formats
   */
  static getSupportedFormats(): string[] {
    return [
      'md',   // Markdown
      'txt',  // Plain text
      'html', // HTML
      'pdf',  // PDF (with additional dependencies)
      'docx', // Word documents
      'xlsx', // Excel spreadsheets
      'jpg',  // Images (with OCR)
      'jpeg', // Images (with OCR)
      'png',  // Images (with OCR)
      'zip',  // ZIP archives
      'ipynb' // Jupyter notebooks
    ];
  }
  
  /**
   * Get usage examples for common operations
   */
  static getUsageExamples(): Record<string, string> {
    return {
      'basic-conversion': `
import { MarkItDown } from 'markitdown-ts';

const markitdown = new MarkItDown();
const result = await markitdown.convert('document.pdf');
console.log(result.text_content);
`,
      'with-options': `
import { MarkItDown } from 'markitdown-ts';

const markitdown = new MarkItDown();
const result = await markitdown.convert('document.pdf', {
  // Add any supported options here
});
console.log(result.text_content);
`,
      'error-handling': `
import { MarkItDown } from 'markitdown-ts';

try {
  const markitdown = new MarkItDown();
  const result = await markitdown.convert('document.pdf');
  console.log(result.text_content);
} catch (error) {
  console.error('Conversion failed:', error);
}
`
    };
  }
}