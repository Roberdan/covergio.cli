/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorConfigManager } from './OrchestratorConfig.js';

describe('OrchestratorConfigManager', () => {
  let configManager: OrchestratorConfigManager;

  beforeEach(() => {
    configManager = new OrchestratorConfigManager();
  });

  describe('constructor', () => {
    it('should create a config manager with default values', () => {
      const config = configManager.getConfig();
      
      expect(config.orchestrator.id).toBe('universal-orchestrator');
      expect(config.orchestrator.name).toBe('Convergio Universal Orchestrator');
      expect(config.agents.maxAgents).toBe(10);
      expect(config.workflow.maxConcurrentWorkflows).toBe(5);
    });
  });

  describe('validate', () => {
    it('should return true for valid config', () => {
      expect(configManager.validate()).toBe(true);
    });
  });

  describe('fromEnv', () => {
    it('should create config from environment variables', () => {
      const originalEnv = process.env;
      
      try {
        process.env.NODE_ENV = 'production';
        process.env.LOG_LEVEL = 'debug';
        process.env.MAX_AGENTS = '25';

        const manager = OrchestratorConfigManager.fromEnv();
        const config = manager.getConfig();

        expect(config.orchestrator.environment).toBe('production');
        expect(config.logging.level).toBe('debug');
        expect(config.agents.maxAgents).toBe(25);
      } finally {
        process.env = originalEnv;
      }
    });
  });
});