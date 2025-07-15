/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import {
  PersonalDataType,
  AnonymizationConfig,
  AnonymizedData,
  DataClassification
} from './types';

/**
 * Service for data anonymization and pseudonymization
 * 
 * Provides various techniques for protecting personal data:
 * - K-anonymity: Ensures each individual is indistinguishable from k-1 others
 * - L-diversity: Adds diversity requirements to sensitive attributes
 * - Differential privacy: Adds statistical noise to protect individual privacy
 * - Pseudonymization: Replaces identifying fields with pseudonyms
 * - Generalization: Reduces precision of data to protect privacy
 */
export class DataAnonymizationService extends EventEmitter {
  private readonly encryptionKey: Buffer;
  private readonly hmacKey: Buffer;
  private readonly anonymizedRecords: Map<string, AnonymizedData> = new Map();

  constructor(
    private readonly config: {
      defaultK: number;
      defaultL: number;
      epsilonDifferentialPrivacy: number;
      encryptionKey: string;
      hmacKey: string;
    }
  ) {
    super();
    this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
    this.hmacKey = Buffer.from(config.hmacKey, 'hex');
  }

  /**
   * Anonymize data using specified technique
   */
  async anonymizeData(
    data: any,
    dataType: PersonalDataType,
    config: AnonymizationConfig,
    originalId?: string
  ): Promise<AnonymizedData> {
    const anonymizedId = this.generateAnonymizedId();
    const startTime = Date.now();

    try {
      let anonymizedValue: any;

      switch (config.technique) {
        case 'k_anonymity':
          anonymizedValue = await this.applyKAnonymity(data, config.parameters);
          break;
        case 'l_diversity':
          anonymizedValue = await this.applyLDiversity(data, config.parameters);
          break;
        case 'differential_privacy':
          anonymizedValue = await this.applyDifferentialPrivacy(data, config.parameters);
          break;
        case 'pseudonymization':
          anonymizedValue = await this.applyPseudonymization(data, config.parameters);
          break;
        case 'generalization':
          anonymizedValue = await this.applyGeneralization(data, config.parameters);
          break;
        default:
          throw new Error(`Unsupported anonymization technique: ${config.technique}`);
      }

      const anonymizedData: AnonymizedData = {
        id: anonymizedId,
        originalId: config.reversible ? originalId : undefined,
        dataType,
        anonymizationMethod: config.technique,
        anonymizedAt: new Date().toISOString(),
        anonymizedBy: 'system', // Could be parameterized
        config,
        qualityMetrics: await this.calculateQualityMetrics(data, anonymizedValue, config)
      };

      // Store the anonymized record
      this.anonymizedRecords.set(anonymizedId, anonymizedData);

      // Emit event for audit logging
      this.emit('dataAnonymized', {
        anonymizedId,
        dataType,
        technique: config.technique,
        processingTime: Date.now() - startTime
      });

      return anonymizedData;
    } catch (error) {
      this.emit('anonymizationError', {
        error: error.message,
        dataType,
        technique: config.technique
      });
      throw error;
    }
  }

  /**
   * Reverse pseudonymization if possible
   */
  async deanonymizeData(anonymizedId: string): Promise<any> {
    const record = this.anonymizedRecords.get(anonymizedId);
    if (!record) {
      throw new Error('Anonymized record not found');
    }

    if (!record.config.reversible) {
      throw new Error('Data cannot be deanonymized - irreversible technique used');
    }

    if (record.config.technique !== 'pseudonymization') {
      throw new Error('Only pseudonymized data can be deanonymized');
    }

    // Implementation would depend on the specific pseudonymization method
    // This is a simplified example
    const originalData = await this.reversePseudonymization(record);

    this.emit('dataDeAnonymized', {
      anonymizedId,
      originalId: record.originalId,
      dataType: record.dataType
    });

    return originalData;
  }

  /**
   * Apply k-anonymity to dataset
   */
  private async applyKAnonymity(data: any, parameters: Record<string, any>): Promise<any> {
    const k = parameters.k || this.config.defaultK;
    const quasiIdentifiers = parameters.quasiIdentifiers || [];

    if (Array.isArray(data)) {
      return this.applyKAnonymityToDataset(data, k, quasiIdentifiers);
    } else {
      return this.applyKAnonymityToRecord(data, k, quasiIdentifiers);
    }
  }

  /**
   * Apply k-anonymity to a dataset
   */
  private applyKAnonymityToDataset(dataset: any[], k: number, quasiIdentifiers: string[]): any[] {
    // Group records by quasi-identifier combinations
    const groups = new Map<string, any[]>();
    
    for (const record of dataset) {
      const key = this.createQuasiIdentifierKey(record, quasiIdentifiers);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Suppress or generalize groups with fewer than k records
    const result: any[] = [];
    for (const [key, group] of groups) {
      if (group.length >= k) {
        result.push(...group);
      } else {
        // Apply generalization to increase group size
        const generalizedGroup = this.generalizeGroup(group, quasiIdentifiers);
        result.push(...generalizedGroup);
      }
    }

    return result;
  }

  /**
   * Apply k-anonymity to a single record
   */
  private applyKAnonymityToRecord(record: any, k: number, quasiIdentifiers: string[]): any {
    const anonymized = { ...record };
    
    // Apply generalization to quasi-identifiers
    for (const field of quasiIdentifiers) {
      if (anonymized[field] !== undefined) {
        anonymized[field] = this.generalizeValue(anonymized[field], field);
      }
    }

    return anonymized;
  }

  /**
   * Apply l-diversity
   */
  private async applyLDiversity(data: any, parameters: Record<string, any>): Promise<any> {
    const l = parameters.l || this.config.defaultL;
    const sensitiveAttributes = parameters.sensitiveAttributes || [];

    // L-diversity ensures that for each group of k-anonymous records,
    // there are at least l distinct values for sensitive attributes
    if (Array.isArray(data)) {
      return this.applyLDiversityToDataset(data, l, sensitiveAttributes);
    } else {
      // For single records, apply noise or generalization
      return this.addNoiseForLDiversity(data, sensitiveAttributes);
    }
  }

  /**
   * Apply differential privacy
   */
  private async applyDifferentialPrivacy(data: any, parameters: Record<string, any>): Promise<any> {
    const epsilon = parameters.epsilon || this.config.epsilonDifferentialPrivacy;
    const mechanism = parameters.mechanism || 'laplace';

    if (typeof data === 'number') {
      return this.addDifferentialPrivacyNoise(data, epsilon, mechanism);
    } else if (Array.isArray(data)) {
      return data.map(item => 
        typeof item === 'number' 
          ? this.addDifferentialPrivacyNoise(item, epsilon, mechanism)
          : item
      );
    } else if (typeof data === 'object') {
      const result = { ...data };
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'number') {
          result[key] = this.addDifferentialPrivacyNoise(value, epsilon, mechanism);
        }
      }
      return result;
    }

    return data;
  }

  /**
   * Apply pseudonymization
   */
  private async applyPseudonymization(data: any, parameters: Record<string, any>): Promise<any> {
    const method = parameters.method || 'hash';
    const salt = parameters.salt || this.generateSalt();

    if (typeof data === 'string') {
      return this.pseudonymizeString(data, method, salt);
    } else if (typeof data === 'object') {
      const result = { ...data };
      const fieldsToAnonymize = parameters.fields || Object.keys(result);
      
      for (const field of fieldsToAnonymize) {
        if (result[field] && typeof result[field] === 'string') {
          result[field] = this.pseudonymizeString(result[field], method, salt);
        }
      }
      return result;
    }

    return data;
  }

  /**
   * Apply generalization
   */
  private async applyGeneralization(data: any, parameters: Record<string, any>): Promise<any> {
    const strategy = parameters.strategy || 'range';
    const precision = parameters.precision || 1;

    if (typeof data === 'number') {
      return this.generalizeNumber(data, strategy, precision);
    } else if (typeof data === 'string') {
      return this.generalizeString(data, strategy, precision);
    } else if (typeof data === 'object') {
      const result = { ...data };
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'number') {
          result[key] = this.generalizeNumber(value, strategy, precision);
        } else if (typeof value === 'string') {
          result[key] = this.generalizeString(value, strategy, precision);
        }
      }
      return result;
    }

    return data;
  }

  /**
   * Pseudonymize a string value
   */
  private pseudonymizeString(value: string, method: string, salt: string): string {
    switch (method) {
      case 'hash':
        return createHash('sha256').update(value + salt).digest('hex');
      case 'hmac':
        return createHmac('sha256', this.hmacKey).update(value + salt).digest('hex');
      case 'format_preserving':
        return this.formatPreservingEncryption(value);
      default:
        return createHash('sha256').update(value + salt).digest('hex');
    }
  }

  /**
   * Add differential privacy noise to numeric value
   */
  private addDifferentialPrivacyNoise(value: number, epsilon: number, mechanism: string): number {
    switch (mechanism) {
      case 'laplace':
        const scale = 1 / epsilon;
        const noise = this.generateLaplaceNoise(scale);
        return value + noise;
      case 'gaussian':
        const sigma = Math.sqrt(2 * Math.log(1.25)) / epsilon;
        const gaussianNoise = this.generateGaussianNoise(0, sigma);
        return value + gaussianNoise;
      default:
        return value;
    }
  }

  /**
   * Generate Laplace noise
   */
  private generateLaplaceNoise(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Generate Gaussian noise
   */
  private generateGaussianNoise(mean: number, sigma: number): number {
    // Box-Muller transformation
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + sigma * z0;
  }

  /**
   * Generalize numeric value
   */
  private generalizeNumber(value: number, strategy: string, precision: number): number {
    switch (strategy) {
      case 'range':
        const range = Math.pow(10, precision);
        return Math.floor(value / range) * range;
      case 'round':
        return Math.round(value / precision) * precision;
      default:
        return Math.floor(value / precision) * precision;
    }
  }

  /**
   * Generalize string value
   */
  private generalizeString(value: string, strategy: string, precision: number): string {
    switch (strategy) {
      case 'truncate':
        return value.substring(0, Math.max(1, value.length - precision));
      case 'mask':
        return value.substring(0, precision) + '*'.repeat(Math.max(0, value.length - precision));
      case 'category':
        return this.categorizeString(value);
      default:
        return value.substring(0, precision) + '*'.repeat(Math.max(0, value.length - precision));
    }
  }

  /**
   * Calculate quality metrics for anonymized data
   */
  private async calculateQualityMetrics(
    original: any,
    anonymized: any,
    config: AnonymizationConfig
  ): Promise<{ utilityScore: number; privacyScore: number; riskLevel: 'low' | 'medium' | 'high' }> {
    const utilityScore = this.calculateUtilityScore(original, anonymized);
    const privacyScore = this.calculatePrivacyScore(config);
    const riskLevel = this.assessRiskLevel(utilityScore, privacyScore);

    return { utilityScore, privacyScore, riskLevel };
  }

  /**
   * Calculate utility score (how useful the data remains)
   */
  private calculateUtilityScore(original: any, anonymized: any): number {
    // Simplified utility calculation
    // In practice, this would be domain-specific
    if (typeof original === 'number' && typeof anonymized === 'number') {
      if (original === 0) return anonymized === 0 ? 1 : 0;
      if (!isFinite(original) || !isFinite(anonymized)) return 0;
      const diff = Math.abs(original - anonymized);
      const relative = diff / Math.abs(original);
      const score = Math.max(0, 1 - relative);
      return isFinite(score) ? score : 0;
    }
    
    if (typeof original === 'string' && typeof anonymized === 'string') {
      const similarity = this.calculateStringSimilarity(original, anonymized);
      return isFinite(similarity) ? similarity : 0;
    }

    // For arrays, objects, or other types, return a default utility score
    return 0.7; // Default utility score
  }

  /**
   * Calculate privacy score based on technique used
   */
  private calculatePrivacyScore(config: AnonymizationConfig): number {
    switch (config.technique) {
      case 'k_anonymity':
        const k = config.parameters.k || this.config.defaultK;
        return Math.min(1, k / 10); // Higher k means better privacy
      case 'differential_privacy':
        const epsilon = config.parameters.epsilon || this.config.epsilonDifferentialPrivacy;
        return Math.max(0, 1 - epsilon); // Lower epsilon means better privacy
      case 'pseudonymization':
        return config.reversible ? 0.7 : 0.9; // Irreversible is better for privacy
      default:
        return 0.5;
    }
  }

  /**
   * Assess overall risk level
   */
  private assessRiskLevel(utilityScore: number, privacyScore: number): 'low' | 'medium' | 'high' {
    const riskScore = 1 - (utilityScore + privacyScore) / 2;
    
    if (riskScore < 0.3) return 'low';
    if (riskScore < 0.7) return 'medium';
    return 'high';
  }

  /**
   * Helper methods
   */

  private generateAnonymizedId(): string {
    return 'anon_' + randomBytes(16).toString('hex');
  }

  private generateSalt(): string {
    return randomBytes(32).toString('hex');
  }

  private createQuasiIdentifierKey(record: any, quasiIdentifiers: string[]): string {
    return quasiIdentifiers
      .map(field => record[field] || 'null')
      .join('|');
  }

  private generalizeGroup(group: any[], quasiIdentifiers: string[]): any[] {
    // Apply generalization to make group larger
    return group.map(record => {
      const generalized = { ...record };
      for (const field of quasiIdentifiers) {
        generalized[field] = this.generalizeValue(generalized[field], field);
      }
      return generalized;
    });
  }

  private generalizeValue(value: any, field: string): any {
    if (typeof value === 'number') {
      return this.generalizeNumber(value, 'range', 1);
    }
    if (typeof value === 'string') {
      return this.generalizeString(value, 'truncate', 1);
    }
    return value;
  }

  private applyLDiversityToDataset(dataset: any[], l: number, sensitiveAttributes: string[]): any[] {
    // Simplified l-diversity implementation
    return dataset.map(record => this.addNoiseForLDiversity(record, sensitiveAttributes));
  }

  private addNoiseForLDiversity(record: any, sensitiveAttributes: string[]): any {
    const result = { ...record };
    for (const attr of sensitiveAttributes) {
      if (result[attr] && typeof result[attr] === 'number') {
        result[attr] += this.generateGaussianNoise(0, 0.1);
      }
    }
    return result;
  }

  private formatPreservingEncryption(value: string): string {
    // Simplified format-preserving encryption
    // In practice, use a proper FPE library
    const hash = createHash('sha256').update(value + this.encryptionKey.toString('hex')).digest('hex');
    return hash.substring(0, value.length);
  }

  private categorizeString(value: string): string {
    // Simple categorization based on string characteristics
    if (/^\d+$/.test(value)) return 'numeric';
    if (/^[a-zA-Z]+$/.test(value)) return 'alphabetic';
    if (/@/.test(value)) return 'email';
    return 'other';
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simplified Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async reversePseudonymization(record: AnonymizedData): Promise<any> {
    // This would require access to the original mapping
    // Implementation depends on the specific pseudonymization method used
    throw new Error('Deanonymization not implemented for this record type');
  }

  /**
   * Get statistics about anonymized data
   */
  getAnonymizationStatistics(): {
    totalRecords: number;
    byTechnique: Record<string, number>;
    byDataType: Record<string, number>;
    averageUtilityScore: number;
    averagePrivacyScore: number;
  } {
    const records = Array.from(this.anonymizedRecords.values());
    const totalRecords = records.length;
    
    const byTechnique: Record<string, number> = {};
    const byDataType: Record<string, number> = {};
    let totalUtility = 0;
    let totalPrivacy = 0;
    
    for (const record of records) {
      byTechnique[record.anonymizationMethod] = (byTechnique[record.anonymizationMethod] || 0) + 1;
      byDataType[record.dataType] = (byDataType[record.dataType] || 0) + 1;
      
      if (record.qualityMetrics) {
        totalUtility += record.qualityMetrics.utilityScore;
        totalPrivacy += record.qualityMetrics.privacyScore;
      }
    }
    
    return {
      totalRecords,
      byTechnique,
      byDataType,
      averageUtilityScore: totalRecords > 0 ? totalUtility / totalRecords : 0,
      averagePrivacyScore: totalRecords > 0 ? totalPrivacy / totalRecords : 0
    };
  }

  /**
   * Clean up old anonymized records
   */
  cleanup(olderThanDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    
    for (const [id, record] of this.anonymizedRecords) {
      const createdDate = new Date(record.anonymizedAt);
      if (createdDate < cutoffDate) {
        this.anonymizedRecords.delete(id);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
}