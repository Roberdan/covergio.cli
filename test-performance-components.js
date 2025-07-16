#!/usr/bin/env node

/**
 * Test script per verificare i componenti di performance implementati
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Test dei componenti di performance Convergio CLI\n');

// Test 1: Verifica esistenza file principali
console.log('📁 Verifica esistenza file principali...');

const requiredFiles = [
  'packages/core/src/universal/performance/CacheManager.ts',
  'packages/core/src/universal/performance/RequestQueue.ts',
  'packages/core/src/universal/performance/CircuitBreaker.ts',
  'packages/core/src/universal/performance/PerformanceManager.ts',
  'packages/core/src/universal/performance/AlertingManager.ts',
  'packages/core/src/universal/performance/DashboardManager.ts',
  'packages/core/src/universal/performance/ReportingManager.ts',
  'packages/core/src/universal/performance/ObservabilityManager.ts',
  'packages/core/src/universal/performance/MetricsCollector.ts',
  'packages/core/src/universal/performance/OpenTelemetryIntegration.ts'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const fullPath = join(__dirname, file);
  if (existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MANCANTE`);
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('\n🎉 Tutti i file principali sono presenti!');
} else {
  console.log('\n⚠️  Alcuni file sono mancanti.');
}

// Test 2: Verifica package.json dependencies
console.log('\n📦 Verifica dipendenze...');

const packageJsonPath = join(__dirname, 'package.json');
if (existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(await import('fs').then(fs => fs.readFileSync(packageJsonPath, 'utf-8')));
    console.log(`✅ package.json trovato`);
    console.log(`   - Nome: ${packageJson.name}`);
    console.log(`   - Versione: ${packageJson.version}`);
    
    if (packageJson.dependencies && packageJson.dependencies['markitdown-ts']) {
      console.log(`✅ MarkItDown dependency: ${packageJson.dependencies['markitdown-ts']}`);
    } else {
      console.log(`⚠️  MarkItDown dependency non trovata`);
    }
  } catch (error) {
    console.log(`❌ Errore lettura package.json: ${error.message}`);
  }
} else {
  console.log(`❌ package.json non trovato`);
}

// Test 3: Verifica script di verifica MarkItDown
console.log('\n🔍 Verifica script MarkItDown...');

const markItDownScripts = [
  'verify-markitdown-simple.js',
  'scripts/verify-markitdown.js',
  'verify-markitdown.ts'
];

for (const script of markItDownScripts) {
  const fullPath = join(__dirname, script);
  if (existsSync(fullPath)) {
    console.log(`✅ ${script}`);
  } else {
    console.log(`⚠️  ${script} - Non trovato`);
  }
}

// Test 4: Verifica struttura workspace
console.log('\n🏗️  Verifica struttura workspace...');

const workspaceDirs = [
  'packages/core',
  'packages/cli',
  '.taskmaster',
  '.taskmaster/tasks',
  '.taskmaster/docs'
];

for (const dir of workspaceDirs) {
  const fullPath = join(__dirname, dir);
  if (existsSync(fullPath)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`⚠️  ${dir}/ - Non trovato`);
  }
}

console.log('\n📊 Test completato!');
console.log('\n🔧 Per proseguire con il testing:');
console.log('   1. npm install           # Installa dipendenze');
console.log('   2. npm run test          # Esegui test unitari');
console.log('   3. npm run typecheck     # Verifica tipi TypeScript');
console.log('   4. npm start             # Avvia il CLI');