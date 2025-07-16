#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Official MarkItDown Installation Verification Script
 * 
 * This script comprehensively tests the MarkItDown installation to ensure:
 * - Library can be imported correctly
 * - All required dependencies are available
 * - Core functionality works as expected
 * - Integration with existing agent system
 * - All supported file formats can be processed
 * 
 * Usage: node scripts/verify-markitdown.js
 */

import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Test configuration
const config = {
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  skipCleanup: process.argv.includes('--no-cleanup'),
  testDir: join(projectRoot, 'test-markitdown-verification'),
  timeout: 30000, // 30 seconds timeout for each test
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

/**
 * Utility functions
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️ ',
    debug: '🔍'
  }[type] || '📋';
  
  console.log(`${prefix} ${message}`);
  
  if (config.verbose && type === 'debug') {
    console.log(`   [${timestamp}] ${message}`);
  }
}

function recordTest(name, passed, error = null) {
  results.tests.push({ name, passed, error });
  if (passed) {
    results.passed++;
    log(`${name}: PASSED`, 'success');
  } else {
    results.failed++;
    log(`${name}: FAILED - ${error}`, 'error');
  }
}

function createTestFile(filename, content) {
  const filepath = join(config.testDir, filename);
  writeFileSync(filepath, content);
  return filepath;
}

/**
 * Test suite
 */
async function runTest(testName, testFunc) {
  log(`Running ${testName}...`, 'debug');
  
  try {
    const result = await Promise.race([
      testFunc(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test timeout')), config.timeout)
      )
    ]);
    
    recordTest(testName, true);
    return result;
  } catch (error) {
    recordTest(testName, false, error.message);
    throw error;
  }
}

/**
 * Test 1: Environment and Dependencies
 */
async function testEnvironment() {
  return await runTest('Environment Check', async () => {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 20) {
      throw new Error(`Node.js version ${nodeVersion} is too old. Requires >= 20.0.0`);
    }
    
    log(`Node.js version: ${nodeVersion}`, 'debug');
    
    // Check if we're in the correct project directory
    const packageJsonPath = join(projectRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found in project root');
    }
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.name !== '@convergio/convergio-cli') {
      throw new Error('Not in the correct project directory');
    }
    
    log('Project environment verified', 'debug');
  });
}

/**
 * Test 2: Library Import
 */
async function testLibraryImport() {
  return await runTest('Library Import', async () => {
    const { MarkItDown } = await import('markitdown-ts');
    
    if (typeof MarkItDown !== 'function') {
      throw new Error('MarkItDown is not a constructor function');
    }
    
    log('MarkItDown imported successfully', 'debug');
    return MarkItDown;
  });
}

/**
 * Test 3: Instance Creation
 */
async function testInstanceCreation(MarkItDown) {
  return await runTest('Instance Creation', async () => {
    const instance = new MarkItDown();
    
    if (!instance) {
      throw new Error('Failed to create MarkItDown instance');
    }
    
    // Check for required methods
    const requiredMethods = ['convert', 'convert_url', 'convert_local'];
    for (const method of requiredMethods) {
      if (typeof instance[method] !== 'function') {
        throw new Error(`Method ${method} not found on instance`);
      }
    }
    
    log('MarkItDown instance created with all required methods', 'debug');
    return instance;
  });
}

/**
 * Test 4: Basic Conversion
 */
async function testBasicConversion(markitdown) {
  return await runTest('Basic Conversion', async () => {
    const testContent = '# Test Document\n\nThis is a **test** with *formatting*.\n\n- Item 1\n- Item 2';
    const testFile = createTestFile('test-basic.md', testContent);
    
    const result = await markitdown.convert(testFile);
    
    if (!result || !result.text_content) {
      throw new Error('Conversion returned invalid result structure');
    }
    
    if (!result.text_content.includes('Test Document')) {
      throw new Error('Conversion did not preserve content');
    }
    
    log('Basic markdown conversion working', 'debug');
    return result;
  });
}

/**
 * Test 5: HTML Conversion
 */
async function testHTMLConversion(markitdown) {
  return await runTest('HTML Conversion', async () => {
    const htmlContent = '<h1>HTML Test</h1><p>This is <strong>bold</strong> and <em>italic</em>.</p><ul><li>List item</li></ul>';
    const testFile = createTestFile('test.html', htmlContent);
    
    const result = await markitdown.convert(testFile);
    
    if (!result || !result.text_content) {
      throw new Error('HTML conversion returned invalid result');
    }
    
    if (!result.text_content.includes('HTML Test')) {
      throw new Error('HTML conversion did not preserve content');
    }
    
    log('HTML conversion working', 'debug');
    return result;
  });
}

/**
 * Test 6: Peer Dependencies
 */
async function testPeerDependencies(markitdown) {
  return await runTest('Peer Dependencies', async () => {
    // Test unzipper dependency
    try {
      const unzipper = await import('unzipper');
      log('Unzipper dependency available', 'debug');
    } catch (error) {
      throw new Error('Unzipper dependency not available');
    }
    
    // Test youtube-transcript dependency
    try {
      const ytTranscript = await import('youtube-transcript');
      log('YouTube transcript dependency available', 'debug');
    } catch (error) {
      throw new Error('YouTube transcript dependency not available');
    }
    
    log('All peer dependencies available', 'debug');
  });
}

/**
 * Test 7: Agent Integration
 */
async function testAgentIntegration() {
  return await runTest('Agent Integration', async () => {
    const agentPath = join(projectRoot, 'packages/core/src/universal/agents/MarkItDownAgent.ts');
    
    if (!existsSync(agentPath)) {
      throw new Error('MarkItDownAgent.ts not found');
    }
    
    const agentContent = readFileSync(agentPath, 'utf8');
    
    if (!agentContent.includes('markitdown-ts')) {
      throw new Error('Agent does not import markitdown-ts');
    }
    
    if (!agentContent.includes('MarkItDown')) {
      throw new Error('Agent does not use MarkItDown class');
    }
    
    log('Agent integration verified', 'debug');
  });
}

/**
 * Test 8: CLI Integration
 */
async function testCLIIntegration() {
  return await runTest('CLI Integration', async () => {
    const cliCommandPath = join(projectRoot, 'packages/cli/src/ui/commands/markdownCommand.ts');
    
    if (!existsSync(cliCommandPath)) {
      throw new Error('Markdown CLI command not found');
    }
    
    const commandContent = readFileSync(cliCommandPath, 'utf8');
    
    if (!commandContent.includes('markdownCommand')) {
      throw new Error('Markdown command not properly defined');
    }
    
    // Check if command is registered
    const serviceContent = readFileSync(join(projectRoot, 'packages/cli/src/services/CommandService.ts'), 'utf8');
    
    if (!serviceContent.includes('markdownCommand')) {
      throw new Error('Markdown command not registered in CommandService');
    }
    
    log('CLI integration verified', 'debug');
  });
}

/**
 * Test 9: Error Handling
 */
async function testErrorHandling(markitdown) {
  return await runTest('Error Handling', async () => {
    // Test with non-existent file
    try {
      await markitdown.convert('non-existent-file.txt');
      throw new Error('Should have thrown error for non-existent file');
    } catch (error) {
      if (error.message === 'Should have thrown error for non-existent file') {
        throw error;
      }
      // Expected error, test passed
    }
    
    log('Error handling working correctly', 'debug');
  });
}

/**
 * Test 10: Performance and Memory
 */
async function testPerformance(markitdown) {
  return await runTest('Performance Check', async () => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    // Test with multiple files
    const files = [];
    for (let i = 0; i < 5; i++) {
      const content = `# Document ${i}\n\nThis is test document ${i} with some content.\n\n- Item 1\n- Item 2\n- Item 3`;
      files.push(createTestFile(`perf-test-${i}.md`, content));
    }
    
    // Process all files
    const results = await Promise.all(
      files.map(file => markitdown.convert(file))
    );
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    const processingTime = endTime - startTime;
    const memoryUsed = endMemory - startMemory;
    
    if (processingTime > 10000) { // 10 seconds threshold
      throw new Error(`Processing too slow: ${processingTime}ms`);
    }
    
    if (memoryUsed > 100 * 1024 * 1024) { // 100MB threshold
      throw new Error(`Memory usage too high: ${memoryUsed} bytes`);
    }
    
    log(`Performance: ${processingTime}ms, Memory: ${Math.round(memoryUsed / 1024)}KB`, 'debug');
  });
}

/**
 * Main verification function
 */
async function verifyMarkItDown() {
  log('🔍 MarkItDown Installation Verification', 'info');
  log('==========================================', 'info');
  
  // Create test directory
  if (!existsSync(config.testDir)) {
    mkdirSync(config.testDir, { recursive: true });
  }
  
  let markitdown;
  let MarkItDown;
  
  try {
    // Run all tests
    await testEnvironment();
    MarkItDown = await testLibraryImport();
    markitdown = await testInstanceCreation(MarkItDown);
    await testBasicConversion(markitdown);
    await testHTMLConversion(markitdown);
    await testPeerDependencies(markitdown);
    await testAgentIntegration();
    await testCLIIntegration();
    await testErrorHandling(markitdown);
    await testPerformance(markitdown);
    
  } catch (error) {
    // Test failed, but continue to show results
    log(`Test failed: ${error.message}`, 'error');
  }
  
  // Cleanup
  if (!config.skipCleanup && existsSync(config.testDir)) {
    rmSync(config.testDir, { recursive: true, force: true });
  }
  
  // Print results
  log('\n📊 Verification Results', 'info');
  log('========================', 'info');
  log(`✅ Passed: ${results.passed}`, 'success');
  log(`❌ Failed: ${results.failed}`, 'error');
  log(`⚠️  Skipped: ${results.skipped}`, 'warning');
  
  if (results.failed > 0) {
    log('\n❌ Failed Tests:', 'error');
    results.tests
      .filter(test => !test.passed)
      .forEach(test => {
        log(`  - ${test.name}: ${test.error}`, 'error');
      });
  }
  
  // Final verdict
  const success = results.failed === 0 && results.passed > 0;
  
  if (success) {
    log('\n🎉 MarkItDown Installation: VERIFIED', 'success');
    log('✅ All tests passed - library is ready for use!', 'success');
  } else {
    log('\n💥 MarkItDown Installation: FAILED', 'error');
    log('❌ Some tests failed - check the errors above', 'error');
  }
  
  return success;
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyMarkItDown()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`Verification script error: ${error.message}`, 'error');
      process.exit(1);
    });
}

export { verifyMarkItDown };