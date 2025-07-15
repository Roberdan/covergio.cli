/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  DataSubjectRequest,
  DataSubjectRights,
  DataSubject,
  ConsentRecord,
  PersonalDataType,
  DataExportOptions,
  ComplianceFramework
} from './types';

/**
 * Manager for handling data subject rights requests (GDPR, CCPA, etc.)
 * 
 * Provides comprehensive handling of:
 * - Right to access (data portability)
 * - Right to rectification (data correction)
 * - Right to erasure (right to be forgotten)
 * - Right to restrict processing
 * - Right to object to processing
 * - Rights related to automated decision-making
 */
export class DataSubjectRightsManager extends EventEmitter {
  private readonly requests: Map<string, DataSubjectRequest> = new Map();
  private readonly dataSubjects: Map<string, DataSubject> = new Map();
  private readonly processingQueue: DataSubjectRequest[] = [];
  private readonly verificationMethods = new Set(['email', 'phone', 'government_id', 'two_factor']);

  constructor(
    private readonly config: {
      responseDeadlineDays: number;
      autoVerificationEnabled: boolean;
      requireManualApproval: string[]; // Request types requiring manual approval
      supportedFrameworks: ComplianceFramework[];
      dataRetentionAfterErasure: number; // days to keep deletion records
    }
  ) {
    super();
    this.startProcessingQueue();
  }

  /**
   * Submit a new data subject request
   */
  async submitRequest(
    requestType: DataSubjectRights,
    dataSubjectId: string,
    description: string,
    requesterId?: string,
    additionalData?: Record<string, any>
  ): Promise<DataSubjectRequest> {
    const requestId = randomUUID();
    const submissionTime = new Date();
    const deadline = new Date(submissionTime.getTime() + this.config.responseDeadlineDays * 24 * 60 * 60 * 1000);

    const request: DataSubjectRequest = {
      id: requestId,
      requestType,
      dataSubjectId,
      requesterId: requesterId || dataSubjectId,
      description,
      submittedAt: submissionTime.toISOString(),
      status: 'submitted',
      deadline: deadline.toISOString(),
      metadata: additionalData
    };

    // Store the request
    this.requests.set(requestId, request);

    // Add to processing queue
    this.processingQueue.push(request);

    // Emit event for audit logging
    this.emit('requestSubmitted', {
      requestId,
      requestType,
      dataSubjectId,
      submittedAt: request.submittedAt
    });

    // Start verification process if enabled
    if (this.config.autoVerificationEnabled) {
      await this.initiateVerification(requestId);
    }

    return request;
  }

  /**
   * Verify a data subject request
   */
  async verifyRequest(
    requestId: string,
    verificationMethod: string,
    verificationData: Record<string, any>
  ): Promise<boolean> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'submitted' && request.status !== 'verification_pending') {
      throw new Error('Request is not in a verifiable state');
    }

    if (!this.verificationMethods.has(verificationMethod)) {
      throw new Error('Unsupported verification method');
    }

    try {
      const isValid = await this.performVerification(request, verificationMethod, verificationData);
      
      if (isValid) {
        request.status = 'verified';
        request.verifiedAt = new Date().toISOString();
        request.verificationMethod = verificationMethod;

        this.emit('requestVerified', {
          requestId,
          dataSubjectId: request.dataSubjectId,
          verificationMethod,
          verifiedAt: request.verifiedAt
        });

        // Check if manual approval is required
        if (this.config.requireManualApproval.includes(request.requestType)) {
          request.status = 'verification_pending';
        } else {
          // Auto-approve for processing
          await this.approveForProcessing(requestId);
        }

        return true;
      } else {
        this.emit('verificationFailed', {
          requestId,
          dataSubjectId: request.dataSubjectId,
          verificationMethod,
          reason: 'Verification data did not match'
        });
        return false;
      }
    } catch (error) {
      this.emit('verificationError', {
        requestId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process a verified request
   */
  async processRequest(requestId: string): Promise<any> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'verified') {
      throw new Error('Request must be verified before processing');
    }

    request.status = 'processing';
    request.processedAt = new Date().toISOString();

    try {
      let result: any;

      switch (request.requestType) {
        case DataSubjectRights.ACCESS:
          result = await this.handleAccessRequest(request);
          break;
        case DataSubjectRights.RECTIFICATION:
          result = await this.handleRectificationRequest(request);
          break;
        case DataSubjectRights.ERASURE:
          result = await this.handleErasureRequest(request);
          break;
        case DataSubjectRights.PORTABILITY:
          result = await this.handlePortabilityRequest(request);
          break;
        case DataSubjectRights.RESTRICTION:
          result = await this.handleRestrictionRequest(request);
          break;
        case DataSubjectRights.OBJECTION:
          result = await this.handleObjectionRequest(request);
          break;
        case DataSubjectRights.AUTOMATED_DECISION:
          result = await this.handleAutomatedDecisionRequest(request);
          break;
        default:
          throw new Error(`Unsupported request type: ${request.requestType}`);
      }

      request.status = 'completed';
      request.completedAt = new Date().toISOString();
      request.responseData = result;

      this.emit('requestCompleted', {
        requestId,
        requestType: request.requestType,
        dataSubjectId: request.dataSubjectId,
        completedAt: request.completedAt,
        processingTime: new Date(request.completedAt).getTime() - new Date(request.processedAt!).getTime()
      });

      return result;
    } catch (error) {
      request.status = 'rejected';
      request.rejectionReason = error.message;

      this.emit('requestRejected', {
        requestId,
        dataSubjectId: request.dataSubjectId,
        reason: error.message
      });

      throw error;
    }
  }

  /**
   * Handle right to access request
   */
  private async handleAccessRequest(request: DataSubjectRequest): Promise<any> {
    const dataSubject = await this.getDataSubject(request.dataSubjectId);
    if (!dataSubject) {
      throw new Error('Data subject not found');
    }

    // Collect all personal data for this subject
    const personalData = await this.collectPersonalData(request.dataSubjectId);
    
    // Get consent records
    const consents = await this.getConsentRecords(request.dataSubjectId);
    
    // Get processing activities
    const processingActivities = await this.getProcessingActivities(request.dataSubjectId);

    // Create comprehensive access report
    const accessReport = {
      dataSubject: {
        id: dataSubject.id,
        identifier: dataSubject.identifier,
        registrationDate: dataSubject.registrationDate,
        lastActivity: dataSubject.lastActivity,
        status: dataSubject.status
      },
      personalData: personalData,
      consents: consents,
      processingActivities: processingActivities,
      dataCategories: this.categorizePersonalData(personalData),
      retentionPolicies: await this.getApplicableRetentionPolicies(request.dataSubjectId),
      thirdPartySharing: await this.getThirdPartySharing(request.dataSubjectId),
      generatedAt: new Date().toISOString(),
      requestId: request.id
    };

    return accessReport;
  }

  /**
   * Handle right to rectification request
   */
  private async handleRectificationRequest(request: DataSubjectRequest): Promise<any> {
    const corrections = request.metadata?.corrections;
    if (!corrections) {
      throw new Error('No corrections specified in request');
    }

    const results = [];
    for (const correction of corrections) {
      try {
        const result = await this.correctPersonalData(
          request.dataSubjectId,
          correction.field,
          correction.oldValue,
          correction.newValue,
          correction.reason
        );
        results.push(result);
      } catch (error) {
        results.push({
          field: correction.field,
          success: false,
          error: error.message
        });
      }
    }

    return {
      dataSubjectId: request.dataSubjectId,
      corrections: results,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Handle right to erasure (right to be forgotten)
   */
  private async handleErasureRequest(request: DataSubjectRequest): Promise<any> {
    const dataSubjectId = request.dataSubjectId;
    const reason = request.metadata?.reason || 'User requested deletion';

    // Check if erasure is legally permissible
    const canErase = await this.checkErasurePermissibility(dataSubjectId, reason);
    if (!canErase.permitted) {
      throw new Error(`Erasure not permitted: ${canErase.reason}`);
    }

    // Perform systematic deletion
    const deletionResults = await this.performSystematicDeletion(dataSubjectId);

    // Update data subject status
    await this.markDataSubjectAsDeleted(dataSubjectId);

    // Create deletion record for compliance
    await this.createDeletionRecord(dataSubjectId, request.id, deletionResults);

    return {
      dataSubjectId,
      deletedAt: new Date().toISOString(),
      reason,
      deletionResults,
      retentionNote: `Deletion record will be retained for ${this.config.dataRetentionAfterErasure} days for compliance purposes`
    };
  }

  /**
   * Handle data portability request
   */
  private async handlePortabilityRequest(request: DataSubjectRequest): Promise<any> {
    const exportOptions: DataExportOptions = {
      format: request.metadata?.format || 'json',
      includeMetadata: request.metadata?.includeMetadata ?? true,
      includeAuditTrail: request.metadata?.includeAuditTrail ?? false,
      anonymize: false,
      compression: request.metadata?.compression ?? false,
      encryption: request.metadata?.encryption,
      digitalSignature: request.metadata?.digitalSignature ?? false
    };

    const personalData = await this.collectPersonalData(request.dataSubjectId);
    const exportedData = await this.exportPersonalData(personalData, exportOptions);

    return {
      dataSubjectId: request.dataSubjectId,
      format: exportOptions.format,
      exportedAt: new Date().toISOString(),
      dataUrl: exportedData.url, // Secure download URL
      expiresAt: exportedData.expiresAt,
      checksum: exportedData.checksum,
      size: exportedData.size
    };
  }

  /**
   * Handle right to restrict processing
   */
  private async handleRestrictionRequest(request: DataSubjectRequest): Promise<any> {
    const restrictions = request.metadata?.restrictions || [];
    const reason = request.metadata?.reason || 'User requested processing restriction';

    const results = [];
    for (const restriction of restrictions) {
      try {
        await this.restrictProcessing(
          request.dataSubjectId,
          restriction.processingType,
          restriction.dataCategory,
          reason
        );
        results.push({
          processingType: restriction.processingType,
          dataCategory: restriction.dataCategory,
          success: true
        });
      } catch (error) {
        results.push({
          processingType: restriction.processingType,
          dataCategory: restriction.dataCategory,
          success: false,
          error: error.message
        });
      }
    }

    return {
      dataSubjectId: request.dataSubjectId,
      restrictions: results,
      restrictedAt: new Date().toISOString(),
      reason
    };
  }

  /**
   * Handle right to object to processing
   */
  private async handleObjectionRequest(request: DataSubjectRequest): Promise<any> {
    const objections = request.metadata?.objections || [];
    const reason = request.metadata?.reason || 'User objects to processing';

    const results = [];
    for (const objection of objections) {
      try {
        const canStop = await this.evaluateObjection(
          request.dataSubjectId,
          objection.processingType,
          objection.legalBasis,
          reason
        );

        if (canStop) {
          await this.stopProcessing(
            request.dataSubjectId,
            objection.processingType,
            reason
          );
          results.push({
            processingType: objection.processingType,
            success: true,
            action: 'stopped'
          });
        } else {
          results.push({
            processingType: objection.processingType,
            success: false,
            action: 'continued',
            reason: 'Legitimate interests override'
          });
        }
      } catch (error) {
        results.push({
          processingType: objection.processingType,
          success: false,
          error: error.message
        });
      }
    }

    return {
      dataSubjectId: request.dataSubjectId,
      objections: results,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Handle automated decision-making rights
   */
  private async handleAutomatedDecisionRequest(request: DataSubjectRequest): Promise<any> {
    const decisions = await this.getAutomatedDecisions(request.dataSubjectId);
    const explanations = [];

    for (const decision of decisions) {
      const explanation = await this.explainAutomatedDecision(decision);
      explanations.push(explanation);
    }

    return {
      dataSubjectId: request.dataSubjectId,
      automatedDecisions: decisions.length,
      explanations,
      rightsNotice: 'You have the right to obtain human intervention, express your point of view, and contest automated decisions.',
      contactInformation: 'Contact our Data Protection Officer for human review of automated decisions.'
    };
  }

  /**
   * Approve request for processing
   */
  async approveForProcessing(requestId: string): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    request.status = 'verified';
    await this.processRequest(requestId);
  }

  /**
   * Reject a request
   */
  async rejectRequest(requestId: string, reason: string): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    request.status = 'rejected';
    request.rejectionReason = reason;

    this.emit('requestRejected', {
      requestId,
      dataSubjectId: request.dataSubjectId,
      reason
    });
  }

  /**
   * Get request status
   */
  getRequestStatus(requestId: string): DataSubjectRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * Get all requests for a data subject
   */
  getRequestsByDataSubject(dataSubjectId: string): DataSubjectRequest[] {
    return Array.from(this.requests.values())
      .filter(request => request.dataSubjectId === dataSubjectId);
  }

  /**
   * Get requests by status
   */
  getRequestsByStatus(status: string): DataSubjectRequest[] {
    return Array.from(this.requests.values())
      .filter(request => request.status === status);
  }

  /**
   * Get overdue requests
   */
  getOverdueRequests(): DataSubjectRequest[] {
    const now = new Date();
    return Array.from(this.requests.values())
      .filter(request => 
        request.status !== 'completed' && 
        request.status !== 'rejected' &&
        new Date(request.deadline) < now
      );
  }

  /**
   * Start the processing queue worker
   */
  private startProcessingQueue(): void {
    setInterval(async () => {
      if (this.processingQueue.length > 0) {
        const request = this.processingQueue.shift();
        if (request && request.status === 'verified') {
          try {
            await this.processRequest(request.id);
          } catch (error) {
            this.emit('processingError', {
              requestId: request.id,
              error: error.message
            });
          }
        }
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Helper methods (implementation details would be system-specific)
   */

  private async initiateVerification(requestId: string): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) return;

    request.status = 'verification_pending';
    // Implementation would send verification email/SMS/etc.
  }

  private async performVerification(
    request: DataSubjectRequest,
    method: string,
    data: Record<string, any>
  ): Promise<boolean> {
    // Implementation would verify the provided data
    // This is a simplified version
    return true;
  }

  private async getDataSubject(dataSubjectId: string): Promise<DataSubject | undefined> {
    return this.dataSubjects.get(dataSubjectId);
  }

  private async collectPersonalData(dataSubjectId: string): Promise<any[]> {
    // Implementation would collect data from all systems
    return [];
  }

  private async getConsentRecords(dataSubjectId: string): Promise<ConsentRecord[]> {
    // Implementation would fetch consent records
    return [];
  }

  private async getProcessingActivities(dataSubjectId: string): Promise<any[]> {
    // Implementation would fetch processing activities
    return [];
  }

  private categorizePersonalData(data: any[]): PersonalDataType[] {
    // Implementation would categorize the data
    return [];
  }

  private async getApplicableRetentionPolicies(dataSubjectId: string): Promise<any[]> {
    return [];
  }

  private async getThirdPartySharing(dataSubjectId: string): Promise<any[]> {
    return [];
  }

  private async correctPersonalData(
    dataSubjectId: string,
    field: string,
    oldValue: any,
    newValue: any,
    reason: string
  ): Promise<any> {
    // Implementation would update the data
    return { success: true, field, oldValue, newValue };
  }

  private async checkErasurePermissibility(
    dataSubjectId: string,
    reason: string
  ): Promise<{ permitted: boolean; reason?: string }> {
    // Check legal obligations, legitimate interests, etc.
    return { permitted: true };
  }

  private async performSystematicDeletion(dataSubjectId: string): Promise<any> {
    // Implementation would delete data across all systems
    return { deletedSystems: [], errors: [] };
  }

  private async markDataSubjectAsDeleted(dataSubjectId: string): Promise<void> {
    const dataSubject = this.dataSubjects.get(dataSubjectId);
    if (dataSubject) {
      dataSubject.status = 'deleted';
    }
  }

  private async createDeletionRecord(
    dataSubjectId: string,
    requestId: string,
    deletionResults: any
  ): Promise<void> {
    // Create audit record of deletion
  }

  private async exportPersonalData(data: any[], options: DataExportOptions): Promise<any> {
    // Implementation would create export file
    return {
      url: 'https://secure-download-url',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      checksum: 'sha256-hash',
      size: 1024
    };
  }

  private async restrictProcessing(
    dataSubjectId: string,
    processingType: string,
    dataCategory: string,
    reason: string
  ): Promise<void> {
    // Implementation would add processing restrictions
  }

  private async evaluateObjection(
    dataSubjectId: string,
    processingType: string,
    legalBasis: string,
    reason: string
  ): Promise<boolean> {
    // Evaluate whether processing can be stopped
    return true;
  }

  private async stopProcessing(
    dataSubjectId: string,
    processingType: string,
    reason: string
  ): Promise<void> {
    // Implementation would stop the specified processing
  }

  private async getAutomatedDecisions(dataSubjectId: string): Promise<any[]> {
    return [];
  }

  private async explainAutomatedDecision(decision: any): Promise<any> {
    return {
      decisionId: decision.id,
      algorithm: 'Decision tree',
      factors: ['Factor 1', 'Factor 2'],
      explanation: 'The decision was made based on...'
    };
  }
}