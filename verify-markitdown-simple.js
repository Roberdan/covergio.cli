#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple MarkItDown Verification Script
 * 
 * This script imports and uses the MarkItDown library to confirm it's working correctly.
 * As specified in the task requirements: imports the library, parses a simple markdown 
 * string, and outputs the result with clear success/failure feedback.
 * 
 * Usage: node verify-markitdown-simple.js
 */

async function verifyMarkItDown() {
  console.log('MarkItDown library verification starting...\n');

  try {
    // Import the MarkItDown library
    console.log('📦 Importing MarkItDown library...');
    const { MarkItDown } = await import('markitdown-ts');
    console.log('✅ Library imported successfully');

    // Create an instance
    console.log('🏗️  Creating MarkItDown instance...');
    const markitdown = new MarkItDown();
    console.log('✅ Instance created successfully');

    // Test parsing with a simple markdown string
    console.log('📝 Testing markdown parsing...');
    const testMarkdown = '# Test Heading\n\nThis is a test paragraph.';
    
    // Write to a temporary file for testing
    const { writeFileSync, unlinkSync } = await import('fs');
    const testFile = 'test-verification.md';
    writeFileSync(testFile, testMarkdown);

    // Parse the markdown
    const result = await markitdown.convert(testFile);
    
    if (result && result.text_content) {
      console.log('✅ Markdown parsing successful');
      console.log('\n📄 Parsed result:');
      console.log(result.text_content);
      console.log('\n🎉 SUCCESS: MarkItDown library is working correctly!');
      
      // Cleanup
      unlinkSync(testFile);
      return true;
    } else {
      throw new Error('Parsing returned invalid result');
    }

  } catch (error) {
    console.error('\n❌ FAILURE: MarkItDown library verification failed');
    console.error('Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('- Check if markitdown-ts is installed: npm install markitdown-ts');
    console.log('- Verify all dependencies are available');
    console.log('- Ensure you are in the correct project directory');
    return false;
  }
}

// Run the verification
verifyMarkItDown()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Script error:', error);
    process.exit(1);
  });