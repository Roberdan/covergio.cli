#!/usr/bin/env node

/**
 * Environment Verification Script
 * 
 * This script analyzes the project structure to determine:
 * - Project type (Node.js vs Python)
 * - Package management system
 * - Existing dependencies
 * - MarkItDown library availability
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function verifyEnvironment() {
  console.log('🔍 Project Environment Analysis');
  console.log('================================\n');

  const projectRoot = process.cwd();
  console.log(`📁 Project Root: ${projectRoot}\n`);

  // Check for package management files
  const packageJsonExists = existsSync(join(projectRoot, 'package.json'));
  const requirementsTxtExists = existsSync(join(projectRoot, 'requirements.txt'));
  const pipfileExists = existsSync(join(projectRoot, 'Pipfile'));
  const pyprojectTomlExists = existsSync(join(projectRoot, 'pyproject.toml'));

  console.log('📦 Package Management Files:');
  console.log(`   package.json: ${packageJsonExists ? '✅ Found' : '❌ Not found'}`);
  console.log(`   requirements.txt: ${requirementsTxtExists ? '✅ Found' : '❌ Not found'}`);
  console.log(`   Pipfile: ${pipfileExists ? '✅ Found' : '❌ Not found'}`);
  console.log(`   pyproject.toml: ${pyprojectTomlExists ? '✅ Found' : '❌ Not found'}\n`);

  // Determine project type
  let projectType = 'Unknown';
  if (packageJsonExists) {
    projectType = 'Node.js/TypeScript';
  } else if (requirementsTxtExists || pipfileExists || pyprojectTomlExists) {
    projectType = 'Python';
  }

  console.log(`🏗️  Project Type: ${projectType}\n`);

  // Analyze Node.js project structure if applicable
  if (packageJsonExists) {
    try {
      const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
      console.log('📋 Package.json Analysis:');
      console.log(`   Name: ${packageJson.name || 'N/A'}`);
      console.log(`   Version: ${packageJson.version || 'N/A'}`);
      console.log(`   Type: ${packageJson.type || 'CommonJS'}`);
      console.log(`   Node Version: ${packageJson.engines?.node || 'Not specified'}`);
      console.log(`   Workspaces: ${packageJson.workspaces ? 'Yes' : 'No'}`);
      
      // Check for existing MarkItDown dependencies
      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};
      const allDeps = { ...dependencies, ...devDependencies };
      
      console.log('\n📚 MarkItDown Related Dependencies:');
      const markdownLibs = Object.keys(allDeps).filter(dep => 
        dep.includes('markdown') || dep.includes('markitdown') || dep.includes('marked')
      );
      
      if (markdownLibs.length > 0) {
        markdownLibs.forEach(lib => {
          console.log(`   ✅ ${lib}: ${allDeps[lib]}`);
        });
      } else {
        console.log('   ❌ No MarkItDown or markdown libraries found');
      }
      
    } catch (error) {
      console.log(`   ❌ Error reading package.json: ${error.message}`);
    }
  }

  // Check workspace structure
  console.log('\n🏢 Workspace Structure:');
  const packagesDir = existsSync(join(projectRoot, 'packages'));
  if (packagesDir) {
    console.log('   ✅ Monorepo structure detected (packages/ directory)');
    
    // Check core and cli packages
    const corePackage = existsSync(join(projectRoot, 'packages/core/package.json'));
    const cliPackage = existsSync(join(projectRoot, 'packages/cli/package.json'));
    
    console.log(`   📦 packages/core: ${corePackage ? '✅ Found' : '❌ Not found'}`);
    console.log(`   📦 packages/cli: ${cliPackage ? '✅ Found' : '❌ Not found'}`);
  } else {
    console.log('   📦 Single package structure');
  }

  // Check for TypeScript configuration
  const tsConfigExists = existsSync(join(projectRoot, 'tsconfig.json'));
  console.log(`\n⚙️  TypeScript Configuration: ${tsConfigExists ? '✅ Found' : '❌ Not found'}`);

  // Check for existing MarkItDown agent implementation
  console.log('\n🤖 MarkItDown Agent Analysis:');
  const markItDownAgentPath = join(projectRoot, 'packages/core/src/universal/agents/MarkItDownAgent.ts');
  const markItDownAgentExists = existsSync(markItDownAgentPath);
  console.log(`   Agent Implementation: ${markItDownAgentExists ? '✅ Found' : '❌ Not found'}`);
  
  if (markItDownAgentExists) {
    try {
      const agentContent = readFileSync(markItDownAgentPath, 'utf8');
      const hasImports = agentContent.includes('import') && agentContent.includes('markitdown');
      console.log(`   MarkItDown Import: ${hasImports ? '✅ Found' : '❌ Not found'}`);
    } catch (error) {
      console.log(`   ❌ Error reading agent file: ${error.message}`);
    }
  }

  // Summary and recommendations
  console.log('\n📊 Summary and Recommendations:');
  console.log('================================');
  
  if (projectType === 'Node.js/TypeScript') {
    console.log('✅ Project is confirmed as Node.js/TypeScript');
    console.log('📦 Use npm for package management');
    console.log('🎯 Target package: markitdown-ts (already installed)');
    console.log('💡 Consider updating to latest version if needed');
  } else if (projectType === 'Python') {
    console.log('✅ Project is confirmed as Python');
    console.log('📦 Use pip for package management');
    console.log('🎯 Target package: markitdown');
  } else {
    console.log('❓ Unable to determine project type clearly');
    console.log('🔍 Manual investigation required');
  }

  return {
    projectType,
    packageManagement: projectType === 'Node.js/TypeScript' ? 'npm' : projectType === 'Python' ? 'pip' : 'unknown',
    hasExistingMarkdownLib: packageJsonExists && JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).dependencies?.['markitdown-ts'],
    monorepo: packagesDir,
    typescript: tsConfigExists,
    markItDownAgentExists
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = verifyEnvironment();
  process.exit(0);
}

export { verifyEnvironment };