/**
 * RAG Service Tests
 * 
 * Basic tests for the RAG Service foundation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RAGService } from './RAGService.js';
import { RAGConfig } from '../config/RAGConfig.js';

describe('RAGService', () => {
  let ragService: RAGService;

  beforeEach(() => {
    ragService = new RAGService();
  });

  describe('initialization', () => {
    it('should create a RAG service instance', () => {
      expect(ragService).toBeInstanceOf(RAGService);
    });

    it('should not be initialized by default', () => {
      expect(ragService.isInitialized()).toBe(false);
    });

    it('should get configuration', () => {
      const config = ragService.getConfiguration();
      expect(config).toBeDefined();
      expect(config.embedding).toBeDefined();
      expect(config.vectorStore).toBeDefined();
      expect(config.chunking).toBeDefined();
      expect(config.agents).toBeDefined();
      expect(config.storage).toBeDefined();
    });

    it('should throw error when accessing methods before initialization', async () => {
      await expect(ragService.listKnowledgeBases()).rejects.toThrow('RAG Service is not initialized');
      await expect(ragService.listAgents()).rejects.toThrow('RAG Service is not initialized');
    });
  });

  describe('configuration', () => {
    it('should throw error when updating configuration before initialization', async () => {
      const updates = {
        embedding: {
          modelName: 'test-model',
          dimensions: 512,
          batchSize: 16,
          device: 'cpu' as const,
          cacheSize: 500
        },
        vectorStore: {
          storePath: '/test',
          dimensions: 512,
          indexType: 'hnsw' as const,
          distanceMetric: 'cosine' as const
        }
      };

      await expect(ragService.updateConfiguration(updates)).rejects.toThrow('RAG Service is not initialized');
    });
  });
});