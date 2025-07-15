/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import {
  ComplianceConfig,
  ComplianceFramework,
  DataSubjectDashboard,
  PrivacyImpactAssessment,
  ProcessingRecord,
  ConsentRecord,
  DataRetentionPolicy,
  DataClassification,
  PersonalDataType,
  ProcessingPurpose,
  ConsentStatus,
  ConsentType
} from './types';
import { DataAnonymizationService } from './DataAnonymizationService';
import { DataSubjectRightsManager } from './DataSubjectRightsManager';
import { DataBreachManager } from './DataBreachManager';

/**
 * Main Compliance Manager
 * 
 * Orchestrates all compliance-related functionality:
 * - Privacy by design implementation
 * - Data classification and governance
 * - Consent management
 * - Regulatory compliance monitoring
 * - Privacy impact assessments
 * - Cross-framework compliance reporting
 */
export class ComplianceManager extends EventEmitter {
  private readonly anonymizationService: DataAnonymizationService;
  private readonly rightsManager: DataSubjectRightsManager;
  private readonly breachManager: DataBreachManager;
  
  private readonly consentRecords: Map<string, ConsentRecord> = new Map();
  private readonly retentionPolicies: Map<string, DataRetentionPolicy> = new Map();
  private readonly processingRecords: Map<string, ProcessingRecord> = new Map();
  private readonly privacyAssessments: Map<string, PrivacyImpactAssessment> = new Map();
  
  private readonly dataClassificationRules: Map<string, ClassificationRule> = new Map();
  private readonly complianceMonitor: ComplianceMonitor;

  constructor(private readonly config: ComplianceConfig) {
    super();

    // Initialize sub-managers
    this.anonymizationService = new DataAnonymizationService({
      defaultK: 5,
      defaultL: 2,
      epsilonDifferentialPrivacy: 1.0,
      encryptionKey: process.env.ANONYMIZATION_ENCRYPTION_KEY || 'default-key',
      hmacKey: process.env.ANONYMIZATION_HMAC_KEY || 'default-hmac-key'
    });

    this.rightsManager = new DataSubjectRightsManager({
      responseDeadlineDays: 30, // GDPR allows up to 30 days
      autoVerificationEnabled: true,
      requireManualApproval: ['erasure', 'restriction'],
      supportedFrameworks: config.enabledFrameworks,
      dataRetentionAfterErasure: 7 * 365 // 7 years for deletion records
    });

    this.breachManager = new DataBreachManager({
      notificationDeadlineHours: 72, // GDPR requirement
      dataSubjectNotificationDeadlineHours: 72,
      autoNotificationEnabled: config.breachNotificationEnabled,
      complianceFrameworks: config.enabledFrameworks,
      incidentResponseTeam: ['security-team@company.com'],
      legalTeam: ['legal@company.com'],
      publicRelationsTeam: ['pr@company.com']
    });

    this.complianceMonitor = new ComplianceMonitor(config);

    this.initializeDefaultPolicies();
    this.initializeClassificationRules();
    this.setupEventHandlers();
  }

  /**
   * Initialize the compliance system
   */
  async initialize(): Promise<void> {
    // Load existing data
    await this.loadRetentionPolicies();
    await this.loadProcessingRecords();
    await this.loadConsentRecords();

    // Start compliance monitoring
    this.complianceMonitor.start();

    this.emit('complianceSystemInitialized', {
      enabledFrameworks: this.config.enabledFrameworks,
      retentionPolicies: this.retentionPolicies.size,
      processingRecords: this.processingRecords.size
    });
  }

  /**
   * Classify data according to privacy regulations
   */
  async classifyData(
    data: any,
    context: {
      dataSource: string;
      collectionMethod: string;
      processingPurpose: ProcessingPurpose;
    }
  ): Promise<DataClassificationResult> {
    const classifications = [];
    
    // Apply classification rules
    for (const [ruleId, rule] of this.dataClassificationRules) {
      if (await this.evaluateClassificationRule(data, rule, context)) {
        classifications.push({
          classification: rule.classification,
          dataType: rule.dataType,
          confidence: rule.confidence,
          rule: ruleId
        });
      }
    }

    // Determine highest classification
    const highestClassification = this.determineHighestClassification(classifications);

    const result: DataClassificationResult = {
      data,
      classifications,
      finalClassification: highestClassification,
      processingRestrictions: await this.getProcessingRestrictions(highestClassification),
      retentionPeriod: await this.getRetentionPeriod(highestClassification, context.processingPurpose),
      classifiedAt: new Date().toISOString(),
      context
    };

    this.emit('dataClassified', {
      classification: highestClassification,
      dataType: classifications[0]?.dataType,
      source: context.dataSource
    });

    return result;
  }

  /**
   * Record consent for data processing
   */
  async recordConsent(
    dataSubjectId: string,
    purpose: ProcessingPurpose,
    consentType: ConsentType,
    grantedAt: Date,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      method: 'web_form' | 'api' | 'email' | 'phone' | 'in_person';
      version: string;
      evidence?: string;
    }
  ): Promise<ConsentRecord> {
    const consentId = `consent_${dataSubjectId}_${purpose}_${Date.now()}`;
    
    const consent: ConsentRecord = {
      id: consentId,
      dataSubjectId,
      purpose,
      consentType,
      status: ConsentStatus.GIVEN,
      grantedAt: grantedAt.toISOString(),
      legalBasis: this.determineLegalBasis(consentType, purpose),
      version: metadata.version,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      method: metadata.method,
      evidence: metadata.evidence
    };

    // Set expiration if applicable
    if (this.requiresConsentExpiration(purpose)) {
      const expirationDate = new Date(grantedAt);
      expirationDate.setFullYear(expirationDate.getFullYear() + 2); // 2 years default
      consent.expiresAt = expirationDate.toISOString();
    }

    this.consentRecords.set(consentId, consent);

    this.emit('consentRecorded', {
      consentId,
      dataSubjectId,
      purpose,
      consentType,
      grantedAt: consent.grantedAt
    });

    return consent;
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    consentId: string,
    withdrawnAt: Date,
    reason?: string
  ): Promise<void> {
    const consent = this.consentRecords.get(consentId);
    if (!consent) {
      throw new Error('Consent record not found');
    }

    consent.status = ConsentStatus.WITHDRAWN;
    consent.withdrawnAt = withdrawnAt.toISOString();

    if (reason) {
      consent.evidence = `${consent.evidence || ''}\nWithdrawal reason: ${reason}`;
    }

    this.emit('consentWithdrawn', {
      consentId,
      dataSubjectId: consent.dataSubjectId,
      purpose: consent.purpose,
      withdrawnAt: consent.withdrawnAt
    });

    // Trigger processing restriction if required
    await this.handleConsentWithdrawal(consent);
  }

  /**
   * Create Privacy Impact Assessment
   */
  async createPrivacyImpactAssessment(
    projectName: string,
    description: string,
    dataTypes: PersonalDataType[],
    processingPurposes: ProcessingPurpose[],
    assessor: string
  ): Promise<PrivacyImpactAssessment> {
    const piaId = `pia_${Date.now()}`;
    const now = new Date();
    const reviewDate = new Date(now);
    reviewDate.setFullYear(reviewDate.getFullYear() + 1);

    // Perform automated risk assessment
    const riskAssessment = await this.performAutomatedRiskAssessment(
      dataTypes,
      processingPurposes
    );

    const pia: PrivacyImpactAssessment = {
      id: piaId,
      projectName,
      description,
      dataTypes,
      processingPurposes,
      legalBasis: this.determineLegalBasisForProcessing(processingPurposes),
      riskLevel: riskAssessment.riskLevel,
      riskFactors: riskAssessment.riskFactors,
      mitigationMeasures: await this.generateMitigationMeasures(riskAssessment),
      approvalRequired: riskAssessment.riskLevel === 'high',
      reviewDate: reviewDate.toISOString(),
      status: riskAssessment.riskLevel === 'high' ? 'review' : 'approved',
      assessor,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    this.privacyAssessments.set(piaId, pia);

    this.emit('privacyImpactAssessmentCreated', {
      piaId,
      projectName,
      riskLevel: pia.riskLevel,
      approvalRequired: pia.approvalRequired
    });

    return pia;
  }

  /**
   * Generate data subject dashboard
   */
  async generateDataSubjectDashboard(dataSubjectId: string): Promise<DataSubjectDashboard> {
    // Get data subject information
    const dataSubject = await this.getDataSubject(dataSubjectId);
    if (!dataSubject) {
      throw new Error('Data subject not found');
    }

    // Get active consents
    const activeConsents = Array.from(this.consentRecords.values())
      .filter(consent => 
        consent.dataSubjectId === dataSubjectId && 
        consent.status === ConsentStatus.GIVEN
      );

    // Get data categories
    const dataCategories = await this.getDataCategoriesForSubject(dataSubjectId);

    // Get processing purposes
    const processingPurposes = activeConsents.map(c => c.purpose);

    // Get applicable retention policies
    const retentionPolicies = Array.from(this.retentionPolicies.values())
      .filter(policy => 
        policy.dataTypes.some(type => dataCategories.includes(type))
      );

    // Get pending requests
    const pendingRequests = this.rightsManager.getRequestsByDataSubject(dataSubjectId)
      .filter(request => request.status !== 'completed' && request.status !== 'rejected');

    // Calculate privacy score
    const privacyScore = await this.calculatePrivacyScore(dataSubjectId);

    // Generate recommendations
    const recommendations = await this.generatePrivacyRecommendations(dataSubjectId);

    const dashboard: DataSubjectDashboard = {
      dataSubject,
      activeConsents,
      dataCategories,
      processingPurposes,
      retentionPolicies,
      pendingRequests,
      dataUsageSummary: await this.getDataUsageSummary(dataSubjectId),
      privacyScore,
      recommendations
    };

    return dashboard;
  }

  /**
   * Perform compliance audit
   */
  async performComplianceAudit(framework: ComplianceFramework): Promise<ComplianceAuditReport> {
    const auditStartTime = new Date();
    
    const findings: ComplianceFinding[] = [];

    switch (framework) {
      case ComplianceFramework.GDPR:
        findings.push(...await this.auditGDPRCompliance());
        break;
      case ComplianceFramework.HIPAA:
        findings.push(...await this.auditHIPAACompliance());
        break;
      case ComplianceFramework.CCPA:
        findings.push(...await this.auditCCPACompliance());
        break;
      default:
        throw new Error(`Unsupported compliance framework: ${framework}`);
    }

    const auditEndTime = new Date();
    const overallScore = this.calculateComplianceScore(findings);

    const report: ComplianceAuditReport = {
      framework,
      auditDate: auditStartTime.toISOString(),
      duration: auditEndTime.getTime() - auditStartTime.getTime(),
      overallScore,
      findings,
      recommendations: this.generateComplianceRecommendations(findings),
      nextAuditDate: this.calculateNextAuditDate(framework),
      summary: this.generateAuditSummary(findings, overallScore)
    };

    this.emit('complianceAuditCompleted', {
      framework,
      overallScore,
      findingsCount: findings.length,
      auditDate: report.auditDate
    });

    return report;
  }

  /**
   * Get anonymization service
   */
  getAnonymizationService(): DataAnonymizationService {
    return this.anonymizationService;
  }

  /**
   * Get rights manager
   */
  getRightsManager(): DataSubjectRightsManager {
    return this.rightsManager;
  }

  /**
   * Get breach manager
   */
  getBreachManager(): DataBreachManager {
    return this.breachManager;
  }

  /**
   * Private helper methods
   */

  private initializeDefaultPolicies(): void {
    // Initialize default retention policies for common data types
    const policies: DataRetentionPolicy[] = [
      {
        id: 'policy_user_data',
        name: 'User Account Data',
        description: 'Standard retention for user account information',
        dataTypes: [PersonalDataType.DIRECT_IDENTIFIER, PersonalDataType.COMMUNICATION_DATA],
        retentionPeriod: 2555, // 7 years in days
        autoDelete: true,
        legalBasis: 'Contract performance and legal obligations',
        reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        approvedBy: 'DPO'
      },
      {
        id: 'policy_analytics',
        name: 'Analytics Data',
        description: 'Retention for anonymized analytics data',
        dataTypes: [PersonalDataType.BEHAVIORAL_DATA],
        retentionPeriod: 1095, // 3 years
        autoDelete: true,
        archiveAfter: 365, // Archive after 1 year
        legalBasis: 'Legitimate interests',
        reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        approvedBy: 'DPO'
      }
    ];

    for (const policy of policies) {
      this.retentionPolicies.set(policy.id, policy);
    }
  }

  private initializeClassificationRules(): void {
    const rules: Array<{ id: string; rule: ClassificationRule }> = [
      {
        id: 'email_rule',
        rule: {
          name: 'Email Address Classification',
          classification: DataClassification.PII,
          dataType: PersonalDataType.DIRECT_IDENTIFIER,
          pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
          confidence: 0.95,
          description: 'Identifies email addresses as PII'
        }
      },
      {
        id: 'ssn_rule',
        rule: {
          name: 'Social Security Number',
          classification: DataClassification.RESTRICTED,
          dataType: PersonalDataType.DIRECT_IDENTIFIER,
          pattern: /\b\d{3}-\d{2}-\d{4}\b/,
          confidence: 0.99,
          description: 'Identifies SSN patterns'
        }
      }
    ];

    for (const { id, rule } of rules) {
      this.dataClassificationRules.set(id, rule);
    }
  }

  private setupEventHandlers(): void {
    // Handle consent expiration
    this.on('consentExpired', async (event) => {
      await this.handleConsentExpiration(event.consentId);
    });

    // Handle data retention
    this.on('retentionPeriodExpired', async (event) => {
      await this.handleDataRetention(event.dataSubjectId, event.dataType);
    });
  }

  private async evaluateClassificationRule(
    data: any,
    rule: ClassificationRule,
    context: any
  ): Promise<boolean> {
    if (rule.pattern && typeof data === 'string') {
      return rule.pattern.test(data);
    }
    
    if (rule.fieldMatcher && typeof data === 'object') {
      return rule.fieldMatcher(data, context);
    }
    
    return false;
  }

  private determineHighestClassification(
    classifications: Array<{ classification: DataClassification; confidence: number }>
  ): DataClassification {
    if (classifications.length === 0) {
      return DataClassification.PUBLIC;
    }

    // Sort by classification level (highest first)
    const order = [
      DataClassification.RESTRICTED,
      DataClassification.PII,
      DataClassification.PHI,
      DataClassification.PCI,
      DataClassification.CONFIDENTIAL,
      DataClassification.INTERNAL,
      DataClassification.PUBLIC
    ];

    for (const level of order) {
      if (classifications.some(c => c.classification === level)) {
        return level;
      }
    }

    return DataClassification.PUBLIC;
  }

  private async getProcessingRestrictions(classification: DataClassification): Promise<string[]> {
    const restrictions = [];
    
    switch (classification) {
      case DataClassification.RESTRICTED:
        restrictions.push('Requires explicit consent');
        restrictions.push('Cannot be transferred outside jurisdiction');
        restrictions.push('Requires encryption at rest and in transit');
        break;
      case DataClassification.PII:
        restrictions.push('Requires lawful basis for processing');
        restrictions.push('Subject to data subject rights');
        break;
    }
    
    return restrictions;
  }

  private async getRetentionPeriod(
    classification: DataClassification,
    purpose: ProcessingPurpose
  ): Promise<number> {
    // Default retention periods based on classification and purpose
    const retentionMatrix = {
      [DataClassification.RESTRICTED]: 2555, // 7 years
      [DataClassification.PII]: 1825, // 5 years
      [DataClassification.CONFIDENTIAL]: 1095, // 3 years
      [DataClassification.INTERNAL]: 730, // 2 years
      [DataClassification.PUBLIC]: 365 // 1 year
    };

    return retentionMatrix[classification] || 365;
  }

  private determineLegalBasis(consentType: ConsentType, purpose: ProcessingPurpose): string {
    if (consentType === ConsentType.EXPLICIT) {
      return 'Article 6(1)(a) GDPR - Consent';
    }
    
    if (consentType === ConsentType.LEGITIMATE_INTEREST) {
      return 'Article 6(1)(f) GDPR - Legitimate interests';
    }
    
    // Default based on purpose
    switch (purpose) {
      case ProcessingPurpose.SERVICE_PROVISION:
        return 'Article 6(1)(b) GDPR - Contract performance';
      case ProcessingPurpose.LEGAL_COMPLIANCE:
        return 'Article 6(1)(c) GDPR - Legal obligation';
      case ProcessingPurpose.SECURITY:
        return 'Article 6(1)(f) GDPR - Legitimate interests (security)';
      default:
        return 'Article 6(1)(a) GDPR - Consent';
    }
  }

  // Additional helper methods would be implemented here...
  private requiresConsentExpiration(purpose: ProcessingPurpose): boolean {
    return [ProcessingPurpose.MARKETING, ProcessingPurpose.ANALYTICS].includes(purpose);
  }

  private async handleConsentWithdrawal(consent: ConsentRecord): Promise<void> {
    // Implementation for handling consent withdrawal
  }

  private async performAutomatedRiskAssessment(
    dataTypes: PersonalDataType[],
    purposes: ProcessingPurpose[]
  ): Promise<{ riskLevel: 'low' | 'medium' | 'high'; riskFactors: string[] }> {
    // Simplified risk assessment
    const riskFactors = [];
    let riskScore = 0;

    if (dataTypes.includes(PersonalDataType.SENSITIVE_DATA)) {
      riskScore += 3;
      riskFactors.push('Processing of sensitive personal data');
    }

    if (dataTypes.includes(PersonalDataType.BIOMETRIC_DATA)) {
      riskScore += 4;
      riskFactors.push('Processing of biometric data');
    }

    if (purposes.includes(ProcessingPurpose.ANALYTICS)) {
      riskScore += 1;
      riskFactors.push('Automated decision making');
    }

    const riskLevel = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
    return { riskLevel, riskFactors };
  }

  private async generateMitigationMeasures(riskAssessment: any): Promise<string[]> {
    const measures = [];
    
    for (const factor of riskAssessment.riskFactors) {
      if (factor.includes('sensitive')) {
        measures.push('Implement enhanced access controls');
        measures.push('Use encryption for data at rest');
      }
      if (factor.includes('biometric')) {
        measures.push('Implement privacy-preserving techniques');
        measures.push('Minimize data collection');
      }
    }
    
    return measures;
  }

  // Placeholder methods for actual implementation
  private async loadRetentionPolicies(): Promise<void> {}
  private async loadProcessingRecords(): Promise<void> {}
  private async loadConsentRecords(): Promise<void> {}
  private async getDataSubject(id: string): Promise<any> { return null; }
  private async getDataCategoriesForSubject(id: string): Promise<PersonalDataType[]> { return []; }
  private async getDataUsageSummary(id: string): Promise<any> { return {}; }
  private async calculatePrivacyScore(id: string): Promise<number> { return 0.8; }
  private async generatePrivacyRecommendations(id: string): Promise<string[]> { return []; }
  private async auditGDPRCompliance(): Promise<ComplianceFinding[]> { return []; }
  private async auditHIPAACompliance(): Promise<ComplianceFinding[]> { return []; }
  private async auditCCPACompliance(): Promise<ComplianceFinding[]> { return []; }
  private calculateComplianceScore(findings: ComplianceFinding[]): number { return 0.85; }
  private generateComplianceRecommendations(findings: ComplianceFinding[]): string[] { return []; }
  private calculateNextAuditDate(framework: ComplianceFramework): string {
    const nextDate = new Date();
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    return nextDate.toISOString();
  }
  private generateAuditSummary(findings: ComplianceFinding[], score: number): string {
    return `Compliance audit completed with ${findings.length} findings and overall score of ${score}`;
  }
  private determineLegalBasisForProcessing(purposes: ProcessingPurpose[]): string {
    return 'Article 6(1)(a) GDPR - Consent';
  }
  private async handleConsentExpiration(consentId: string): Promise<void> {}
  private async handleDataRetention(dataSubjectId: string, dataType: PersonalDataType): Promise<void> {}
}

// Supporting interfaces
interface ClassificationRule {
  name: string;
  classification: DataClassification;
  dataType: PersonalDataType;
  pattern?: RegExp;
  fieldMatcher?: (data: any, context: any) => boolean;
  confidence: number;
  description: string;
}

interface DataClassificationResult {
  data: any;
  classifications: Array<{
    classification: DataClassification;
    dataType: PersonalDataType;
    confidence: number;
    rule: string;
  }>;
  finalClassification: DataClassification;
  processingRestrictions: string[];
  retentionPeriod: number;
  classifiedAt: string;
  context: any;
}

interface ComplianceFinding {
  id: string;
  type: 'violation' | 'risk' | 'recommendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  framework: ComplianceFramework;
  reference: string; // Article/section reference
}

interface ComplianceAuditReport {
  framework: ComplianceFramework;
  auditDate: string;
  duration: number;
  overallScore: number;
  findings: ComplianceFinding[];
  recommendations: string[];
  nextAuditDate: string;
  summary: string;
}

class ComplianceMonitor {
  constructor(private config: ComplianceConfig) {}
  
  start(): void {
    // Start monitoring compliance metrics
  }
  
  stop(): void {
    // Stop monitoring
  }
}