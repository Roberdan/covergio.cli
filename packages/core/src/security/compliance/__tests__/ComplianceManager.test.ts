/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComplianceManager } from '../ComplianceManager';
import {
  ComplianceFramework,
  DataClassification,
  PersonalDataType,
  ProcessingPurpose,
  ConsentType,
  ConsentStatus
} from '../types';

describe('ComplianceManager', () => {
  let complianceManager: ComplianceManager;
  let config: any;

  beforeEach(() => {
    config = {
      enabledFrameworks: [ComplianceFramework.GDPR, ComplianceFramework.CCPA],
      defaultJurisdiction: 'EU-GDPR',
      dataRetentionPolicies: [],
      automaticDeletion: true,
      breachNotificationEnabled: true,
      breachNotificationDeadline: 72,
      regulatoryContacts: {
        'EU-GDPR': 'dpa@example.com'
      },
      dpoContact: 'dpo@example.com',
      auditSettings: {
        frequency: 12,
        autoSchedule: true,
        notificationDays: 30
      }
    };

    complianceManager = new ComplianceManager(config);
  });

  afterEach(async () => {
    // Cleanup if needed
  });

  describe('Data Classification', () => {
    it('should classify email addresses as PII', async () => {
      const testData = 'user@example.com';
      const context = {
        dataSource: 'user_registration',
        collectionMethod: 'web_form',
        processingPurpose: ProcessingPurpose.SERVICE_PROVISION
      };

      const result = await complianceManager.classifyData(testData, context);

      expect(result.finalClassification).toBe(DataClassification.PII);
      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].dataType).toBe(PersonalDataType.DIRECT_IDENTIFIER);
      expect(result.classifications[0].confidence).toBeGreaterThan(0.9);
    });

    it('should classify SSN as restricted data', async () => {
      const testData = '123-45-6789';
      const context = {
        dataSource: 'identity_verification',
        collectionMethod: 'manual_entry',
        processingPurpose: ProcessingPurpose.LEGAL_COMPLIANCE
      };

      const result = await complianceManager.classifyData(testData, context);

      expect(result.finalClassification).toBe(DataClassification.RESTRICTED);
      expect(result.processingRestrictions).toContain('Requires explicit consent');
      expect(result.processingRestrictions).toContain('Cannot be transferred outside jurisdiction');
    });

    it('should handle unclassified data as public', async () => {
      const testData = 'some random text';
      const context = {
        dataSource: 'blog_comments',
        collectionMethod: 'web_form',
        processingPurpose: ProcessingPurpose.SERVICE_PROVISION
      };

      const result = await complianceManager.classifyData(testData, context);

      expect(result.finalClassification).toBe(DataClassification.PUBLIC);
      expect(result.classifications).toHaveLength(0);
    });
  });

  describe('Consent Management', () => {
    it('should record explicit consent', async () => {
      const dataSubjectId = 'user123';
      const purpose = ProcessingPurpose.MARKETING;
      const grantedAt = new Date();
      const metadata = {
        method: 'web_form' as const,
        version: '1.0',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...'
      };

      const consent = await complianceManager.recordConsent(
        dataSubjectId,
        purpose,
        ConsentType.EXPLICIT,
        grantedAt,
        metadata
      );

      expect(consent.dataSubjectId).toBe(dataSubjectId);
      expect(consent.purpose).toBe(purpose);
      expect(consent.consentType).toBe(ConsentType.EXPLICIT);
      expect(consent.status).toBe(ConsentStatus.GIVEN);
      expect(consent.grantedAt).toBe(grantedAt.toISOString());
      expect(consent.legalBasis).toContain('Article 6(1)(a) GDPR');
      expect(consent.expiresAt).toBeDefined(); // Marketing consent should expire
    });

    it('should withdraw consent properly', async () => {
      // First record consent
      const dataSubjectId = 'user123';
      const grantedAt = new Date();
      const consent = await complianceManager.recordConsent(
        dataSubjectId,
        ProcessingPurpose.MARKETING,
        ConsentType.EXPLICIT,
        grantedAt,
        { method: 'web_form', version: '1.0' }
      );

      // Then withdraw it
      const withdrawnAt = new Date();
      const reason = 'User requested withdrawal';
      
      await complianceManager.withdrawConsent(consent.id, withdrawnAt, reason);

      // Verify withdrawal
      const updatedConsent = complianceManager['consentRecords'].get(consent.id);
      expect(updatedConsent?.status).toBe(ConsentStatus.WITHDRAWN);
      expect(updatedConsent?.withdrawnAt).toBe(withdrawnAt.toISOString());
      expect(updatedConsent?.evidence).toContain(reason);
    });

    it('should set appropriate legal basis for different consent types', async () => {
      const dataSubjectId = 'user123';
      const grantedAt = new Date();

      // Test service provision consent
      const serviceConsent = await complianceManager.recordConsent(
        dataSubjectId,
        ProcessingPurpose.SERVICE_PROVISION,
        ConsentType.IMPLIED,
        grantedAt,
        { method: 'web_form', version: '1.0' }
      );

      expect(serviceConsent.legalBasis).toContain('Article 6(1)(b) GDPR - Contract performance');

      // Test security consent
      const securityConsent = await complianceManager.recordConsent(
        dataSubjectId,
        ProcessingPurpose.SECURITY,
        ConsentType.LEGITIMATE_INTEREST,
        grantedAt,
        { method: 'web_form', version: '1.0' }
      );

      expect(securityConsent.legalBasis).toContain('Article 6(1)(f) GDPR - Legitimate interests');
    });
  });

  describe('Privacy Impact Assessment', () => {
    it('should create PIA for high-risk processing', async () => {
      const projectName = 'Biometric Authentication System';
      const description = 'Implementation of facial recognition for user authentication';
      const dataTypes = [PersonalDataType.BIOMETRIC_DATA, PersonalDataType.DIRECT_IDENTIFIER];
      const processingPurposes = [ProcessingPurpose.SECURITY, ProcessingPurpose.SERVICE_PROVISION];
      const assessor = 'privacy-officer@example.com';

      const pia = await complianceManager.createPrivacyImpactAssessment(
        projectName,
        description,
        dataTypes,
        processingPurposes,
        assessor
      );

      expect(pia.projectName).toBe(projectName);
      expect(pia.riskLevel).toBe('high'); // Biometric data should trigger high risk
      expect(pia.approvalRequired).toBe(true);
      expect(pia.status).toBe('review'); // High risk should require review
      expect(pia.riskFactors).toContain('Processing of biometric data');
      expect(pia.mitigationMeasures.length).toBeGreaterThan(0);
    });

    it('should create PIA for low-risk processing', async () => {
      const projectName = 'Newsletter Signup';
      const description = 'Simple email newsletter subscription';
      const dataTypes = [PersonalDataType.DIRECT_IDENTIFIER]; // Just email
      const processingPurposes = [ProcessingPurpose.MARKETING];
      const assessor = 'privacy-officer@example.com';

      const pia = await complianceManager.createPrivacyImpactAssessment(
        projectName,
        description,
        dataTypes,
        processingPurposes,
        assessor
      );

      expect(pia.riskLevel).toBe('low');
      expect(pia.approvalRequired).toBe(false);
      expect(pia.status).toBe('approved'); // Low risk should auto-approve
    });
  });

  describe('Data Subject Dashboard', () => {
    it('should generate comprehensive dashboard for data subject', async () => {
      const dataSubjectId = 'user123';

      // Mock some data for the test
      const mockDataSubject = {
        id: dataSubjectId,
        identifier: 'user123@example.com',
        identifierType: 'email' as const,
        dataClassifications: [DataClassification.PII],
        jurisdiction: 'EU-GDPR',
        registrationDate: new Date().toISOString(),
        status: 'active' as const
      };

      // Mock the getDataSubject method
      vi.spyOn(complianceManager as any, 'getDataSubject').mockResolvedValue(mockDataSubject);
      vi.spyOn(complianceManager as any, 'getDataCategoriesForSubject').mockResolvedValue([PersonalDataType.DIRECT_IDENTIFIER]);
      vi.spyOn(complianceManager as any, 'getDataUsageSummary').mockResolvedValue({
        lastAccessed: new Date().toISOString(),
        accessCount: 25,
        dataVolume: '2.5MB'
      });
      vi.spyOn(complianceManager as any, 'calculatePrivacyScore').mockResolvedValue(0.85);
      vi.spyOn(complianceManager as any, 'generatePrivacyRecommendations').mockResolvedValue([
        'Review and update consent preferences',
        'Consider enabling two-factor authentication'
      ]);

      const dashboard = await complianceManager.generateDataSubjectDashboard(dataSubjectId);

      expect(dashboard.dataSubject.id).toBe(dataSubjectId);
      expect(dashboard.dataCategories).toContain(PersonalDataType.DIRECT_IDENTIFIER);
      expect(dashboard.privacyScore).toBe(0.85);
      expect(dashboard.recommendations).toHaveLength(2);
      expect(dashboard.dataUsageSummary.accessCount).toBe(25);
    });
  });

  describe('System Integration', () => {
    it('should provide access to sub-managers', () => {
      const anonymizationService = complianceManager.getAnonymizationService();
      const rightsManager = complianceManager.getRightsManager();
      const breachManager = complianceManager.getBreachManager();

      expect(anonymizationService).toBeDefined();
      expect(rightsManager).toBeDefined();
      expect(breachManager).toBeDefined();
    });

    it('should emit events for compliance activities', async () => {
      const eventSpy = vi.fn();
      complianceManager.on('consentRecorded', eventSpy);

      await complianceManager.recordConsent(
        'user123',
        ProcessingPurpose.ANALYTICS,
        ConsentType.EXPLICIT,
        new Date(),
        { method: 'web_form', version: '1.0' }
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          dataSubjectId: 'user123',
          purpose: ProcessingPurpose.ANALYTICS,
          consentType: ConsentType.EXPLICIT
        })
      );
    });

    it('should handle initialization properly', async () => {
      const initSpy = vi.fn();
      complianceManager.on('complianceSystemInitialized', initSpy);

      await complianceManager.initialize();

      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledFrameworks: config.enabledFrameworks
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid consent withdrawal', async () => {
      const invalidConsentId = 'non-existent-consent';
      const withdrawnAt = new Date();

      await expect(
        complianceManager.withdrawConsent(invalidConsentId, withdrawnAt)
      ).rejects.toThrow('Consent record not found');
    });

    it('should handle missing data subject in dashboard generation', async () => {
      const nonExistentDataSubjectId = 'non-existent-user';

      // Mock getDataSubject to return null
      vi.spyOn(complianceManager as any, 'getDataSubject').mockResolvedValue(null);

      await expect(
        complianceManager.generateDataSubjectDashboard(nonExistentDataSubjectId)
      ).rejects.toThrow('Data subject not found');
    });
  });

  describe('Compliance Audit', () => {
    it('should perform GDPR compliance audit', async () => {
      // Mock audit methods
      vi.spyOn(complianceManager as any, 'auditGDPRCompliance').mockResolvedValue([
        {
          id: 'finding-1',
          type: 'recommendation',
          severity: 'medium',
          title: 'Consent Management',
          description: 'Review consent collection procedures',
          recommendation: 'Implement granular consent options',
          framework: ComplianceFramework.GDPR,
          reference: 'Article 7'
        }
      ]);

      const auditReport = await complianceManager.performComplianceAudit(ComplianceFramework.GDPR);

      expect(auditReport.framework).toBe(ComplianceFramework.GDPR);
      expect(auditReport.findings).toHaveLength(1);
      expect(auditReport.overallScore).toBeGreaterThan(0);
      expect(auditReport.nextAuditDate).toBeDefined();
      expect(auditReport.summary).toContain('findings');
    });

    it('should throw error for unsupported compliance framework', async () => {
      const unsupportedFramework = 'INVALID_FRAMEWORK' as ComplianceFramework;

      await expect(
        complianceManager.performComplianceAudit(unsupportedFramework)
      ).rejects.toThrow('Unsupported compliance framework');
    });
  });
});