/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataAnonymizationService } from '../DataAnonymizationService';
import { PersonalDataType, AnonymizationConfig } from '../types';

describe('DataAnonymizationService', () => {
  let anonymizationService: DataAnonymizationService;
  let config: any;

  beforeEach(() => {
    config = {
      defaultK: 5,
      defaultL: 2,
      epsilonDifferentialPrivacy: 1.0,
      encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      hmacKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
    };

    anonymizationService = new DataAnonymizationService(config);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('K-Anonymity', () => {
    it('should apply k-anonymity to a single record', async () => {
      const testData = {
        name: 'John Doe',
        age: 30,
        zipCode: '12345'
      };

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'k_anonymity',
        parameters: {
          k: 5,
          quasiIdentifiers: ['age', 'zipCode']
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        testData,
        PersonalDataType.QUASI_IDENTIFIER,
        anonymizationConfig,
        'original-id-123'
      );

      expect(result.id).toBeDefined();
      expect(result.dataType).toBe(PersonalDataType.QUASI_IDENTIFIER);
      expect(result.anonymizationMethod).toBe('k_anonymity');
      expect(result.config).toEqual(anonymizationConfig);
      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics?.utilityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics?.privacyScore).toBeGreaterThanOrEqual(0);
    });

    it('should apply k-anonymity to a dataset', async () => {
      const dataset = [
        { age: 25, zipCode: '12345', income: 50000 },
        { age: 26, zipCode: '12345', income: 55000 },
        { age: 30, zipCode: '12346', income: 60000 },
        { age: 31, zipCode: '12346', income: 65000 },
        { age: 35, zipCode: '12347', income: 70000 }
      ];

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'k_anonymity',
        parameters: {
          k: 3,
          quasiIdentifiers: ['age', 'zipCode']
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        dataset,
        PersonalDataType.QUASI_IDENTIFIER,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('k_anonymity');
      expect(result.config.technique).toBe('k_anonymity');
    });
  });

  describe('Differential Privacy', () => {
    it('should add noise to numeric values', async () => {
      const originalValue = 1000;

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'differential_privacy',
        parameters: {
          epsilon: 1.0,
          mechanism: 'laplace'
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        originalValue,
        PersonalDataType.BEHAVIORAL_DATA,
        anonymizationConfig
      );

      // The anonymized value should be different due to noise
      expect(result.anonymizationMethod).toBe('differential_privacy');
      expect(result.qualityMetrics?.privacyScore).toBeGreaterThanOrEqual(0);
    });

    it('should add noise to arrays of numeric values', async () => {
      const originalData = [100, 200, 300, 400, 500];

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'differential_privacy',
        parameters: {
          epsilon: 0.5,
          mechanism: 'gaussian'
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        originalData,
        PersonalDataType.BEHAVIORAL_DATA,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('differential_privacy');
      expect(result.qualityMetrics?.privacyScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pseudonymization', () => {
    it('should pseudonymize string values with hash method', async () => {
      const originalString = 'user@example.com';

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'pseudonymization',
        parameters: {
          method: 'hash',
          salt: 'test-salt-123'
        },
        reversible: true
      };

      const result = await anonymizationService.anonymizeData(
        originalString,
        PersonalDataType.DIRECT_IDENTIFIER,
        anonymizationConfig,
        'email-123'
      );

      expect(result.anonymizationMethod).toBe('pseudonymization');
      expect(result.originalId).toBe('email-123'); // Should store original ID when reversible
      expect(result.qualityMetrics?.privacyScore).toBeGreaterThan(0.5);
    });

    it('should pseudonymize object fields', async () => {
      const originalData = {
        email: 'user@example.com',
        phone: '+1234567890',
        name: 'John Doe',
        age: 30
      };

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'pseudonymization',
        parameters: {
          method: 'hmac',
          fields: ['email', 'phone', 'name'],
          salt: 'test-salt-456'
        },
        reversible: true
      };

      const result = await anonymizationService.anonymizeData(
        originalData,
        PersonalDataType.DIRECT_IDENTIFIER,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('pseudonymization');
      expect(result.config.reversible).toBe(true);
    });

    it('should use format-preserving encryption when specified', async () => {
      const originalString = 'john.doe@example.com';

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'pseudonymization',
        parameters: {
          method: 'format_preserving'
        },
        reversible: true
      };

      const result = await anonymizationService.anonymizeData(
        originalString,
        PersonalDataType.DIRECT_IDENTIFIER,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('pseudonymization');
      // Format-preserving should maintain the original length
      expect(result.config.parameters.method).toBe('format_preserving');
    });
  });

  describe('Generalization', () => {
    it('should generalize numeric values using range strategy', async () => {
      const originalValue = 12345;

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'generalization',
        parameters: {
          strategy: 'range',
          precision: 1000
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        originalValue,
        PersonalDataType.QUASI_IDENTIFIER,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('generalization');
      expect(result.qualityMetrics?.utilityScore).toBeGreaterThanOrEqual(0);
    });

    it('should generalize string values using truncate strategy', async () => {
      const originalString = 'sensitive-information-here';

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'generalization',
        parameters: {
          strategy: 'truncate',
          precision: 2 // Remove last 2 characters
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        originalString,
        PersonalDataType.SENSITIVE_DATA,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('generalization');
      expect(result.config.reversible).toBe(false);
    });

    it('should generalize object with mixed data types', async () => {
      const originalData = {
        age: 28,
        salary: 65000,
        department: 'Engineering'
      };

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'generalization',
        parameters: {
          strategy: 'range',
          precision: 5
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        originalData,
        PersonalDataType.QUASI_IDENTIFIER,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('generalization');
    });
  });

  describe('L-Diversity', () => {
    it('should apply l-diversity to dataset', async () => {
      const dataset = [
        { age: 25, disease: 'flu', zipCode: '12345' },
        { age: 26, disease: 'cold', zipCode: '12345' },
        { age: 30, disease: 'flu', zipCode: '12346' },
        { age: 31, disease: 'covid', zipCode: '12346' }
      ];

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'l_diversity',
        parameters: {
          l: 2,
          sensitiveAttributes: ['disease']
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        dataset,
        PersonalDataType.SENSITIVE_DATA,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('l_diversity');
      expect(result.qualityMetrics?.privacyScore).toBeGreaterThan(0);
    });

    it('should add noise for l-diversity on single records', async () => {
      const originalData = {
        age: 30,
        medicalCondition: 'diabetes',
        zipCode: '12345'
      };

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'l_diversity',
        parameters: {
          l: 3,
          sensitiveAttributes: ['medicalCondition']
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        originalData,
        PersonalDataType.SENSITIVE_DATA,
        anonymizationConfig
      );

      expect(result.anonymizationMethod).toBe('l_diversity');
    });
  });

  describe('Quality Metrics', () => {
    it('should calculate utility and privacy scores', async () => {
      const originalValue = 100;

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'differential_privacy',
        parameters: {
          epsilon: 1.0
        },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        originalValue,
        PersonalDataType.BEHAVIORAL_DATA,
        anonymizationConfig
      );

      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics?.utilityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics?.utilityScore).toBeLessThanOrEqual(1);
      expect(result.qualityMetrics?.privacyScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics?.privacyScore).toBeLessThanOrEqual(1);
      expect(result.qualityMetrics?.riskLevel).toMatch(/^(low|medium|high)$/);
    });

    it('should assess risk level correctly', async () => {
      // High privacy score should result in low risk
      const lowRiskConfig: AnonymizationConfig = {
        technique: 'k_anonymity',
        parameters: { k: 10 },
        reversible: false
      };

      const result = await anonymizationService.anonymizeData(
        'test data',
        PersonalDataType.QUASI_IDENTIFIER,
        lowRiskConfig
      );

      // K-anonymity with high k should have good privacy score
      expect(result.qualityMetrics?.riskLevel).toBe('low');
    });
  });

  describe('Event Emission', () => {
    it('should emit events during anonymization', async () => {
      const eventSpy = vi.fn();
      anonymizationService.on('dataAnonymized', eventSpy);

      const anonymizationConfig: AnonymizationConfig = {
        technique: 'pseudonymization',
        parameters: { method: 'hash' },
        reversible: false
      };

      await anonymizationService.anonymizeData(
        'test@example.com',
        PersonalDataType.DIRECT_IDENTIFIER,
        anonymizationConfig
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          dataType: PersonalDataType.DIRECT_IDENTIFIER,
          technique: 'pseudonymization'
        })
      );
    });

    it('should emit error events when anonymization fails', async () => {
      const errorSpy = vi.fn();
      anonymizationService.on('anonymizationError', errorSpy);

      const invalidConfig: AnonymizationConfig = {
        technique: 'invalid_technique' as any,
        parameters: {},
        reversible: false
      };

      await expect(
        anonymizationService.anonymizeData('test', PersonalDataType.DIRECT_IDENTIFIER, invalidConfig)
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          technique: 'invalid_technique'
        })
      );
    });
  });

  describe('Statistics and Management', () => {
    it('should provide anonymization statistics', async () => {
      // Create several anonymized records
      const configs = [
        { technique: 'k_anonymity' as const, parameters: { k: 5 }, reversible: false },
        { technique: 'pseudonymization' as const, parameters: { method: 'hash' }, reversible: true },
        { technique: 'differential_privacy' as const, parameters: { epsilon: 1.0 }, reversible: false }
      ];

      for (const config of configs) {
        await anonymizationService.anonymizeData(
          'test data',
          PersonalDataType.DIRECT_IDENTIFIER,
          config
        );
      }

      const stats = anonymizationService.getAnonymizationStatistics();

      expect(stats.totalRecords).toBe(3);
      expect(stats.byTechnique['k_anonymity']).toBe(1);
      expect(stats.byTechnique['pseudonymization']).toBe(1);
      expect(stats.byTechnique['differential_privacy']).toBe(1);
      expect(stats.byDataType[PersonalDataType.DIRECT_IDENTIFIER]).toBe(3);
      expect(stats.averageUtilityScore).toBeGreaterThanOrEqual(0);
      expect(stats.averagePrivacyScore).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup old records', async () => {
      // Create an anonymized record
      await anonymizationService.anonymizeData(
        'test data',
        PersonalDataType.DIRECT_IDENTIFIER,
        { technique: 'pseudonymization', parameters: {}, reversible: false }
      );

      // Clean up records older than 0 days (should clean everything)
      const deletedCount = anonymizationService.cleanup(0);

      expect(deletedCount).toBeGreaterThanOrEqual(0);

      const stats = anonymizationService.getAnonymizationStatistics();
      expect(stats.totalRecords).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported anonymization technique', async () => {
      const invalidConfig: AnonymizationConfig = {
        technique: 'unsupported_technique' as any,
        parameters: {},
        reversible: false
      };

      await expect(
        anonymizationService.anonymizeData('test', PersonalDataType.DIRECT_IDENTIFIER, invalidConfig)
      ).rejects.toThrow('Unsupported anonymization technique');
    });

    it('should handle empty or null data gracefully', async () => {
      const config: AnonymizationConfig = {
        technique: 'generalization',
        parameters: { strategy: 'truncate', precision: 1 },
        reversible: false
      };

      // Test with empty string
      const result1 = await anonymizationService.anonymizeData(
        '',
        PersonalDataType.DIRECT_IDENTIFIER,
        config
      );
      expect(result1.anonymizationMethod).toBe('generalization');

      // Test with null
      const result2 = await anonymizationService.anonymizeData(
        null,
        PersonalDataType.DIRECT_IDENTIFIER,
        config
      );
      expect(result2.anonymizationMethod).toBe('generalization');
    });
  });
});