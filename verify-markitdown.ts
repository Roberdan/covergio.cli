#!/usr/bin/env tsx

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple MarkItDown Verification Script (TypeScript)
 * 
 * This is a simplified verification script that imports the MarkItDown library,
 * parses a simple markdown string, and outputs the result.
 * 
 * Usage: npx tsx verify-markitdown.ts
 *        or: node -r esbuild-register verify-markitdown.ts
 */

import { MarkItDown } from 'markitdown-ts';
import { writeFileSync, unlinkSync } from 'fs';

async function verifyMarkItDown(): Promise<boolean> {
  console.log('🔍 MarkItDown Library Verification');
  console.log('=================================\n');

  try {
    // Test 1: Import and instantiate
    console.log('📦 Testing library import and instantiation...');
    const markitdown = new MarkItDown();
    console.log('✅ MarkItDown library imported and instantiated successfully\n');

    // Test 2: Basic functionality
    console.log('📝 Testing basic markdown parsing...');
    const testMarkdown = `# Test Heading

This is a test paragraph with **bold** and *italic* text.

## Subheading

- List item 1
- List item 2
- List item 3

Here's a [link](https://example.com) and some \`inline code\`.

\`\`\`typescript
const test = "code block";
console.log(test);
\`\`\`
`;

    // Create a temporary file
    const testFile = 'temp-test.md';
    writeFileSync(testFile, testMarkdown);

    const result = await markitdown.convert(testFile);
    
    if (!result || !result.text_content) {
      throw new Error('Conversion returned invalid result structure');
    }

    console.log('✅ Markdown parsing successful');
    console.log('📄 Parsed content preview:');
    console.log(result.text_content.substring(0, 200) + '...\n');

    // Test 3: Verify parsed content
    console.log('🔍 Verifying parsed content...');
    const content = result.text_content;
    
    if (!content.includes('Test Heading')) {
      throw new Error('Heading not properly parsed');
    }
    
    if (!content.includes('bold') && !content.includes('**bold**')) {
      throw new Error('Bold formatting not preserved');
    }
    
    if (!content.includes('List item')) {
      throw new Error('List items not properly parsed');
    }

    console.log('✅ Content verification passed\n');

    // Cleanup
    unlinkSync(testFile);

    // Summary
    console.log('📊 Verification Summary');
    console.log('=======================');
    console.log('✅ Library import: Working');
    console.log('✅ Instance creation: Working');
    console.log('✅ File parsing: Working');
    console.log('✅ Content preservation: Working');
    console.log('\n🎉 MarkItDown library is working correctly!');
    
    return true;

  } catch (error) {
    console.error('❌ Verification failed:', error instanceof Error ? error.message : String(error));
    console.log('\n💡 Possible solutions:');
    console.log('1. Ensure markitdown-ts is installed: npm install markitdown-ts');
    console.log('2. Check that all peer dependencies are installed');
    console.log('3. Verify the project is built correctly');
    
    return false;
  }
}

// Export for module use
export { verifyMarkItDown };

// Run if called directly
if (require.main === module) {
  verifyMarkItDown()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Script error:', error);
      process.exit(1);
    });
}