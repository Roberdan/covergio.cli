/**
 * Tests for RAGConfig class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RAGConfig } from './RAGConfig.js';
import { ChunkingStrategy, IndexType, DistanceMetric } from '../types/index.js';

describe('RAGConfig', () => {
  let config: RAGConfig;

  beforeEach(() => {
    config = new RAGConfig();
  });

  describe('constructor', () => {
    it('should create config with default values', () => {
      const defaultConfig = config.getConfig();
      
      expect(defaultConfig.embedding.modelName).toBe('all-MiniLM-L6-v2');
      expect(defaultConfig.embedding.dimensions).toBe(384);
      expect(defaultConfig.embedding.device).toBe('cpu');
      expect(defaultConfig.vectorStore.indexType).toBe(IndexType.HNSW);
      expect(defaultConfig.vectorStore.distanceMetric).toBe(DistanceMetric.COSINE);
      expect(defaultConfig.chunking.strategy).toBe(ChunkingStrategy.SEMANTIC);
    });

    it('should merge custom config with defaults', () => {
      const customConfig = new RAGConfig({
        embedding: {
          modelName: 'custom-model',
          dimensions: 768
        }
      });

      const result = customConfig.getEmbeddingConfig();
      expect(result.modelName).toBe('custom-model');
      expect(result.dimensions).toBe(768);
      expect(result.device).toBe('cpu'); // Should keep default
    });
  });

  describe('validation', () => {
    it('should throw error for invalid embedding dimensions', () => {
      expect(() => {
        new RAGConfig({
          embedding: { dimensions: -1 }
        });
      }).toThrow('Embedding dimensions must be positive');
    });

    it('should throw error for invalid batch size', () => {
      expect(() => {
        new RAGConfig({
          embedding: { batchSize: 0 }
        });
      }).toThrow('Batch size must be positive');
    });

    it('should throw error for invalid chunk overlap', () => {
      expect(() => {
        new RAGConfig({
          chunking: { 
            defaultSize: 100,
            defaultOverlap: 150
          }
        });
      }).toThrow('Chunk overlap must be less than chunk size');
    });

    it('should throw error for invalid temperature', () => {
      expect(() => {
        new RAGConfig({
          agents: { defaultTemperature: 3.0 }
        });
      }).toThrow('Temperature must be between 0 and 2');
    });
  });

  describe('getters', () => {
    it('should return embedding config', () => {
      const embeddingConfig = config.getEmbeddingConfig();
      expect(embeddingConfig).toHaveProperty('modelName');
      expect(embeddingConfig).toHaveProperty('dimensions');
      expect(embeddingConfig).toHaveProperty('device');
    });

    it('should return vector store config', () => {
      const vectorConfig = config.getVectorStoreConfig();
      expect(vectorConfig).toHaveProperty('storePath');
      expect(vectorConfig).toHaveProperty('dimensions');
      expect(vectorConfig).toHaveProperty('indexType');
    });

    it('should return chunking config', () => {
      const chunkingConfig = config.getChunkingConfig();
      expect(chunkingConfig).toHaveProperty('defaultSize');
      expect(chunkingConfig).toHaveProperty('strategy');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      config.updateConfig({
        embedding: { modelName: 'updated-model' }
      });

      const embeddingConfig = config.getEmbeddingConfig();
      expect(embeddingConfig.modelName).toBe('updated-model');
    });

    it('should validate updated configuration', () => {
      expect(() => {
        config.updateConfig({
          embedding: { dimensions: -1 }
        });
      }).toThrow('Embedding dimensions must be positive');
    });
  });
});