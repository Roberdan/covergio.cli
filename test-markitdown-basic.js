#!/usr/bin/env node

/**
 * Basic MarkItDown functionality test
 */

import { MarkItDown } from 'markitdown-ts';
import { writeFileSync } from 'fs';

async function testBasicFunctionality() {
  console.log('🧪 Testing MarkItDown basic functionality...\n');
  
  const markitdown = new MarkItDown();
  
  // Test 1: Create a simple text file and convert it
  console.log('📝 Test 1: Converting text content...');
  try {
    const testContent = 'This is a test document.\n\nIt has multiple paragraphs.\n\n- List item 1\n- List item 2';
    writeFileSync('test-input.txt', testContent);
    
    const result = await markitdown.convert('test-input.txt');
    
    if (result && result.text_content) {
      console.log('✅ Text conversion successful');
      console.log('📄 Result preview:');
      console.log(result.text_content.substring(0, 200) + '...');
    } else {
      console.log('❌ Text conversion failed - unexpected result structure');
      console.log('Result:', result);
    }
  } catch (error) {
    console.log('❌ Text conversion failed:', error.message);
  }
  
  // Test 2: Test with HTML content
  console.log('\n🌐 Test 2: Converting HTML content...');
  try {
    const htmlContent = '<h1>Test HTML</h1><p>This is a <strong>test</strong> paragraph.</p><ul><li>Item 1</li><li>Item 2</li></ul>';
    writeFileSync('test-input.html', htmlContent);
    
    const result = await markitdown.convert('test-input.html');
    
    if (result && result.text_content) {
      console.log('✅ HTML conversion successful');
      console.log('📄 Result preview:');
      console.log(result.text_content.substring(0, 200) + '...');
    } else {
      console.log('❌ HTML conversion failed - unexpected result structure');
      console.log('Result:', result);
    }
  } catch (error) {
    console.log('❌ HTML conversion failed:', error.message);
  }
  
  // Test 3: Test available methods
  console.log('\n🔧 Available methods on MarkItDown instance:');
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(markitdown))
    .filter(method => method !== 'constructor' && typeof markitdown[method] === 'function');
  
  methods.forEach(method => {
    console.log(`   - ${method}`);
  });
  
  console.log('\n📊 Basic functionality test completed!');
  
  // Cleanup
  try {
    const { unlinkSync } = await import('fs');
    unlinkSync('test-input.txt');
    unlinkSync('test-input.html');
  } catch (error) {
    // Ignore cleanup errors
  }
}

testBasicFunctionality().catch(console.error);