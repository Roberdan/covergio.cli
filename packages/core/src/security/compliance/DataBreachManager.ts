/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  DataBreach,
  BreachSeverity,
  PersonalDataType,
  ComplianceFramework
} from './types';

/**
 * Data Breach Management System
 * 
 * Provides comprehensive breach management capabilities:
 * - Incident detection and classification
 * - Automated notification workflows
 * - Regulatory reporting (72-hour GDPR rule, etc.)
 * - Impact assessment and containment
 * - Recovery and lessons learned documentation
 */
export class DataBreachManager extends EventEmitter {
  private readonly breaches: Map<string, DataBreach> = new Map();
  private readonly notificationTemplates: Map<string, NotificationTemplate> = new Map();
  private readonly regulatoryContacts: Map<string, RegulatoryContact> = new Map();
  private readonly escalationRules: EscalationRule[] = [];

  constructor(
    private readonly config: {
      notificationDeadlineHours: number; // GDPR: 72 hours
      dataSubjectNotificationDeadlineHours: number; // GDPR: without undue delay
      autoNotificationEnabled: boolean;
      complianceFrameworks: ComplianceFramework[];
      incidentResponseTeam: string[];
      legalTeam: string[];
      publicRelationsTeam: string[];
    }
  ) {
    super();
    this.initializeNotificationTemplates();
    this.setupEscalationRules();
  }

  /**
   * Report a new data breach
   */
  async reportBreach(
    title: string,
    description: string,
    affectedRecords: number,
    affectedDataTypes: PersonalDataType[],
    affectedJurisdictions: string[],
    discoveryDetails?: {
      discoveredBy: string;
      discoveryMethod: string;
      rootCause?: string;
      impact?: string;
    }
  ): Promise<DataBreach> {
    const breachId = randomUUID();
    const discoveredAt = new Date();
    
    // Calculate initial severity
    const severity = this.calculateSeverity(affectedRecords, affectedDataTypes);
    
    // Determine notification requirements
    const notificationRequired = this.assessNotificationRequirement(
      severity,
      affectedDataTypes,
      affectedJurisdictions
    );

    const breach: DataBreach = {
      id: breachId,
      title,
      description,
      severity,
      discoveredAt: discoveredAt.toISOString(),
      affectedRecords,
      affectedDataTypes,
      affectedJurisdictions,
      rootCause: discoveryDetails?.rootCause || 'Under investigation',
      impact: discoveryDetails?.impact || 'Assessment in progress',
      mitigationActions: [],
      notificationRequired,
      notificationDeadline: notificationRequired 
        ? new Date(discoveredAt.getTime() + this.config.notificationDeadlineHours * 60 * 60 * 1000).toISOString()
        : undefined,
      regulatoryReported: false,
      reportedTo: [],
      status: 'discovered',
      assignedTo: discoveryDetails?.discoveredBy || 'incident-response-team',
      metadata: {
        discoveredBy: discoveryDetails?.discoveredBy,
        discoveryMethod: discoveryDetails?.discoveryMethod,
        reportedAt: discoveredAt.toISOString()
      }
    };

    this.breaches.set(breachId, breach);

    // Emit breach discovered event
    this.emit('breachDiscovered', {
      breachId,
      severity,
      affectedRecords,
      notificationRequired,
      deadline: breach.notificationDeadline
    });

    // Trigger immediate response actions
    await this.initiateIncidentResponse(breach);

    // Auto-escalate based on severity
    await this.applyEscalationRules(breach);

    return breach;
  }

  /**
   * Update breach status
   */
  async updateBreachStatus(
    breachId: string,
    status: DataBreach['status'],
    updates?: Partial<DataBreach>
  ): Promise<DataBreach> {
    const breach = this.breaches.get(breachId);
    if (!breach) {
      throw new Error('Breach not found');
    }

    const previousStatus = breach.status;
    breach.status = status;

    // Apply updates
    if (updates) {
      Object.assign(breach, updates);
    }

    // Set timestamps based on status
    switch (status) {
      case 'investigating':
        // Already set during discovery
        break;
      case 'contained':
        breach.containedAt = new Date().toISOString();
        break;
      case 'resolved':
        breach.resolvedAt = new Date().toISOString();
        break;
      case 'closed':
        if (!breach.resolvedAt) {
          breach.resolvedAt = new Date().toISOString();
        }
        break;
    }

    this.emit('breachStatusUpdated', {
      breachId,
      previousStatus,
      newStatus: status,
      updatedAt: new Date().toISOString()
    });

    // Trigger status-specific actions
    await this.handleStatusChange(breach, previousStatus);

    return breach;
  }

  /**
   * Add mitigation action to breach
   */
  async addMitigationAction(
    breachId: string,
    action: string,
    assignedTo?: string,
    dueDate?: string
  ): Promise<void> {
    const breach = this.breaches.get(breachId);
    if (!breach) {
      throw new Error('Breach not found');
    }

    const mitigationAction = {
      id: randomUUID(),
      action,
      assignedTo: assignedTo || breach.assignedTo,
      createdAt: new Date().toISOString(),
      dueDate,
      status: 'pending' as const,
      completedAt: undefined
    };

    breach.mitigationActions.push(mitigationAction);

    this.emit('mitigationActionAdded', {
      breachId,
      actionId: mitigationAction.id,
      action,
      assignedTo: mitigationAction.assignedTo
    });
  }

  /**
   * Complete mitigation action
   */
  async completeMitigationAction(
    breachId: string,
    actionId: string,
    notes?: string
  ): Promise<void> {
    const breach = this.breaches.get(breachId);
    if (!breach) {
      throw new Error('Breach not found');
    }

    const action = breach.mitigationActions.find(a => a.id === actionId);
    if (!action) {
      throw new Error('Mitigation action not found');
    }

    action.status = 'completed';
    action.completedAt = new Date().toISOString();
    if (notes) {
      action.notes = notes;
    }

    this.emit('mitigationActionCompleted', {
      breachId,
      actionId,
      completedAt: action.completedAt
    });

    // Check if all actions are complete and auto-update status
    const allCompleted = breach.mitigationActions.every(a => a.status === 'completed');
    if (allCompleted && breach.status === 'contained') {
      await this.updateBreachStatus(breachId, 'resolved');
    }
  }

  /**
   * Send regulatory notification
   */
  async sendRegulatoryNotification(
    breachId: string,
    jurisdiction: string,
    customMessage?: string
  ): Promise<void> {
    const breach = this.breaches.get(breachId);
    if (!breach) {
      throw new Error('Breach not found');
    }

    const contact = this.regulatoryContacts.get(jurisdiction);
    if (!contact) {
      throw new Error(`No regulatory contact found for jurisdiction: ${jurisdiction}`);
    }

    const template = this.notificationTemplates.get('regulatory');
    if (!template) {
      throw new Error('Regulatory notification template not found');
    }

    const notification = this.generateNotification(breach, template, customMessage);

    try {
      await this.sendNotification(contact, notification);
      
      breach.regulatoryReported = true;
      breach.reportedTo = [...breach.reportedTo, jurisdiction];
      breach.reportedAt = new Date().toISOString();

      this.emit('regulatoryNotificationSent', {
        breachId,
        jurisdiction,
        sentAt: breach.reportedAt,
        recipient: contact.email
      });
    } catch (error) {
      this.emit('notificationError', {
        breachId,
        jurisdiction,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send data subject notification
   */
  async sendDataSubjectNotifications(
    breachId: string,
    dataSubjects: Array<{ id: string; email: string; preferredLanguage?: string }>
  ): Promise<void> {
    const breach = this.breaches.get(breachId);
    if (!breach) {
      throw new Error('Breach not found');
    }

    const template = this.notificationTemplates.get('data_subject');
    if (!template) {
      throw new Error('Data subject notification template not found');
    }

    const notificationPromises = dataSubjects.map(async (subject) => {
      try {
        const personalizedNotification = this.generatePersonalizedNotification(
          breach,
          template,
          subject
        );
        
        await this.sendDataSubjectNotification(subject, personalizedNotification);
        
        return { subjectId: subject.id, success: true };
      } catch (error) {
        return { subjectId: subject.id, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(notificationPromises);
    
    this.emit('dataSubjectNotificationsSent', {
      breachId,
      totalRecipients: dataSubjects.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
    });
  }

  /**
   * Generate breach assessment report
   */
  async generateAssessmentReport(breachId: string): Promise<BreachAssessmentReport> {
    const breach = this.breaches.get(breachId);
    if (!breach) {
      throw new Error('Breach not found');
    }

    const timeline = this.generateTimeline(breach);
    const impactAnalysis = await this.analyzeImpact(breach);
    const complianceAssessment = this.assessCompliance(breach);
    const lessonsLearned = await this.extractLessonsLearned(breach);

    const report: BreachAssessmentReport = {
      breachId,
      generatedAt: new Date().toISOString(),
      summary: {
        title: breach.title,
        severity: breach.severity,
        affectedRecords: breach.affectedRecords,
        duration: this.calculateDuration(breach),
        status: breach.status
      },
      timeline,
      impactAnalysis,
      complianceAssessment,
      mitigationActions: breach.mitigationActions,
      lessonsLearned,
      recommendations: await this.generateRecommendations(breach)
    };

    this.emit('assessmentReportGenerated', {
      breachId,
      reportGeneratedAt: report.generatedAt
    });

    return report;
  }

  /**
   * Get breach statistics
   */
  getBreachStatistics(timeframeMonths: number = 12): BreachStatistics {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - timeframeMonths);

    const relevantBreaches = Array.from(this.breaches.values())
      .filter(breach => new Date(breach.discoveredAt) >= cutoffDate);

    const statistics: BreachStatistics = {
      totalBreaches: relevantBreaches.length,
      bySeverity: this.groupBySeverity(relevantBreaches),
      byStatus: this.groupByStatus(relevantBreaches),
      byDataType: this.groupByDataType(relevantBreaches),
      totalAffectedRecords: relevantBreaches.reduce((sum, breach) => sum + breach.affectedRecords, 0),
      averageContainmentTime: this.calculateAverageContainmentTime(relevantBreaches),
      averageResolutionTime: this.calculateAverageResolutionTime(relevantBreaches),
      regulatoryReportingCompliance: this.calculateComplianceRate(relevantBreaches),
      timeframe: `${timeframeMonths} months`,
      generatedAt: new Date().toISOString()
    };

    return statistics;
  }

  /**
   * Private helper methods
   */

  private calculateSeverity(affectedRecords: number, dataTypes: PersonalDataType[]): BreachSeverity {
    let score = 0;

    // Score based on number of affected records
    if (affectedRecords >= 100000) score += 3;
    else if (affectedRecords >= 10000) score += 2;
    else if (affectedRecords >= 1000) score += 1;

    // Score based on data sensitivity
    const sensitiveTypes = [
      PersonalDataType.SENSITIVE_DATA,
      PersonalDataType.BIOMETRIC_DATA,
      PersonalDataType.FINANCIAL_DATA,
      PersonalDataType.DIRECT_IDENTIFIER
    ];

    if (dataTypes.some(type => sensitiveTypes.includes(type))) {
      score += 2;
    }

    // Determine severity
    if (score >= 4) return BreachSeverity.CRITICAL;
    if (score >= 3) return BreachSeverity.HIGH;
    if (score >= 2) return BreachSeverity.MEDIUM;
    return BreachSeverity.LOW;
  }

  private assessNotificationRequirement(
    severity: BreachSeverity,
    dataTypes: PersonalDataType[],
    jurisdictions: string[]
  ): boolean {
    // GDPR requires notification if likely to result in risk to rights and freedoms
    if (jurisdictions.some(j => j.startsWith('EU-'))) {
      return severity !== BreachSeverity.LOW;
    }

    // Other jurisdictions may have different requirements
    return severity === BreachSeverity.HIGH || severity === BreachSeverity.CRITICAL;
  }

  private async initiateIncidentResponse(breach: DataBreach): Promise<void> {
    // Notify incident response team
    for (const member of this.config.incidentResponseTeam) {
      this.emit('incidentResponseRequired', {
        breachId: breach.id,
        assignee: member,
        severity: breach.severity,
        deadline: breach.notificationDeadline
      });
    }

    // Start containment procedures
    await this.addMitigationAction(
      breach.id,
      'Initiate containment procedures',
      'incident-response-team'
    );

    // Begin impact assessment
    await this.addMitigationAction(
      breach.id,
      'Conduct detailed impact assessment',
      'incident-response-team'
    );
  }

  private async applyEscalationRules(breach: DataBreach): Promise<void> {
    for (const rule of this.escalationRules) {
      if (this.ruleApplies(rule, breach)) {
        await this.executeEscalation(rule, breach);
      }
    }
  }

  private ruleApplies(rule: EscalationRule, breach: DataBreach): boolean {
    if (rule.severity && !rule.severity.includes(breach.severity)) {
      return false;
    }
    if (rule.affectedRecordsThreshold && breach.affectedRecords < rule.affectedRecordsThreshold) {
      return false;
    }
    if (rule.dataTypes && !rule.dataTypes.some(type => breach.affectedDataTypes.includes(type))) {
      return false;
    }
    return true;
  }

  private async executeEscalation(rule: EscalationRule, breach: DataBreach): Promise<void> {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'notify_team':
          this.emit('escalationNotification', {
            breachId: breach.id,
            team: action.target,
            rule: rule.name,
            message: action.message
          });
          break;
        case 'auto_contain':
          await this.addMitigationAction(
            breach.id,
            'Automatic containment triggered',
            'system'
          );
          break;
        case 'external_notification':
          if (this.config.autoNotificationEnabled) {
            // Schedule regulatory notification
            setTimeout(() => {
              this.sendRegulatoryNotification(breach.id, action.target);
            }, action.delay || 0);
          }
          break;
      }
    }
  }

  private async handleStatusChange(breach: DataBreach, previousStatus: string): Promise<void> {
    switch (breach.status) {
      case 'contained':
        this.emit('breachContained', {
          breachId: breach.id,
          containedAt: breach.containedAt,
          containmentTime: this.calculateContainmentTime(breach)
        });
        break;
      case 'resolved':
        this.emit('breachResolved', {
          breachId: breach.id,
          resolvedAt: breach.resolvedAt,
          resolutionTime: this.calculateResolutionTime(breach)
        });
        break;
    }
  }

  private generateTimeline(breach: DataBreach): Array<{ timestamp: string; event: string; details?: string }> {
    const timeline = [];
    
    timeline.push({
      timestamp: breach.discoveredAt,
      event: 'Breach Discovered',
      details: breach.description
    });

    if (breach.reportedAt) {
      timeline.push({
        timestamp: breach.reportedAt,
        event: 'Regulatory Notification Sent'
      });
    }

    if (breach.containedAt) {
      timeline.push({
        timestamp: breach.containedAt,
        event: 'Breach Contained'
      });
    }

    if (breach.resolvedAt) {
      timeline.push({
        timestamp: breach.resolvedAt,
        event: 'Breach Resolved'
      });
    }

    // Add mitigation actions to timeline
    for (const action of breach.mitigationActions) {
      timeline.push({
        timestamp: action.createdAt,
        event: 'Mitigation Action Started',
        details: action.action
      });

      if (action.completedAt) {
        timeline.push({
          timestamp: action.completedAt,
          event: 'Mitigation Action Completed',
          details: action.action
        });
      }
    }

    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private async analyzeImpact(breach: DataBreach): Promise<any> {
    return {
      dataTypes: breach.affectedDataTypes,
      jurisdictions: breach.affectedJurisdictions,
      estimatedCost: this.estimateBreachCost(breach),
      reputationalImpact: this.assessReputationalImpact(breach),
      legalImplications: this.assessLegalImplications(breach)
    };
  }

  private assessCompliance(breach: DataBreach): any {
    const compliance = {};
    
    for (const framework of this.config.complianceFrameworks) {
      compliance[framework] = this.assessFrameworkCompliance(breach, framework);
    }
    
    return compliance;
  }

  private async extractLessonsLearned(breach: DataBreach): Promise<string[]> {
    // In a real implementation, this might analyze the breach and extract insights
    return [
      'Review access controls for affected systems',
      'Enhance monitoring for early detection',
      'Update incident response procedures',
      'Provide additional security training'
    ];
  }

  private async generateRecommendations(breach: DataBreach): Promise<string[]> {
    const recommendations = [];
    
    if (breach.severity >= BreachSeverity.HIGH) {
      recommendations.push('Conduct comprehensive security audit');
      recommendations.push('Implement additional monitoring controls');
    }
    
    if (breach.affectedDataTypes.includes(PersonalDataType.FINANCIAL_DATA)) {
      recommendations.push('Review PCI DSS compliance');
      recommendations.push('Enhance payment processing security');
    }
    
    return recommendations;
  }

  private calculateDuration(breach: DataBreach): number | undefined {
    if (breach.resolvedAt) {
      return new Date(breach.resolvedAt).getTime() - new Date(breach.discoveredAt).getTime();
    }
    return undefined;
  }

  private calculateContainmentTime(breach: DataBreach): number | undefined {
    if (breach.containedAt) {
      return new Date(breach.containedAt).getTime() - new Date(breach.discoveredAt).getTime();
    }
    return undefined;
  }

  private calculateResolutionTime(breach: DataBreach): number | undefined {
    if (breach.resolvedAt) {
      return new Date(breach.resolvedAt).getTime() - new Date(breach.discoveredAt).getTime();
    }
    return undefined;
  }

  private groupBySeverity(breaches: DataBreach[]): Record<string, number> {
    return breaches.reduce((acc, breach) => {
      acc[breach.severity] = (acc[breach.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByStatus(breaches: DataBreach[]): Record<string, number> {
    return breaches.reduce((acc, breach) => {
      acc[breach.status] = (acc[breach.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByDataType(breaches: DataBreach[]): Record<string, number> {
    const result = {};
    for (const breach of breaches) {
      for (const dataType of breach.affectedDataTypes) {
        result[dataType] = (result[dataType] || 0) + 1;
      }
    }
    return result;
  }

  private calculateAverageContainmentTime(breaches: DataBreach[]): number {
    const containedBreaches = breaches.filter(b => b.containedAt);
    if (containedBreaches.length === 0) return 0;
    
    const totalTime = containedBreaches.reduce((sum, breach) => {
      return sum + (this.calculateContainmentTime(breach) || 0);
    }, 0);
    
    return totalTime / containedBreaches.length;
  }

  private calculateAverageResolutionTime(breaches: DataBreach[]): number {
    const resolvedBreaches = breaches.filter(b => b.resolvedAt);
    if (resolvedBreaches.length === 0) return 0;
    
    const totalTime = resolvedBreaches.reduce((sum, breach) => {
      return sum + (this.calculateResolutionTime(breach) || 0);
    }, 0);
    
    return totalTime / resolvedBreaches.length;
  }

  private calculateComplianceRate(breaches: DataBreach[]): number {
    const requiredNotifications = breaches.filter(b => b.notificationRequired);
    if (requiredNotifications.length === 0) return 1;
    
    const compliantNotifications = requiredNotifications.filter(b => {
      if (!b.reportedAt || !b.notificationDeadline) return false;
      return new Date(b.reportedAt) <= new Date(b.notificationDeadline);
    });
    
    return compliantNotifications.length / requiredNotifications.length;
  }

  // Placeholder methods for actual implementation
  private estimateBreachCost(breach: DataBreach): number {
    // Implement cost estimation logic
    return breach.affectedRecords * 150; // $150 per record (industry average)
  }

  private assessReputationalImpact(breach: DataBreach): string {
    if (breach.severity === BreachSeverity.CRITICAL) return 'High';
    if (breach.severity === BreachSeverity.HIGH) return 'Medium';
    return 'Low';
  }

  private assessLegalImplications(breach: DataBreach): string[] {
    const implications = [];
    
    if (breach.affectedJurisdictions.some(j => j.startsWith('EU-'))) {
      implications.push('GDPR Article 33 notification required');
      implications.push('Potential regulatory fines up to 4% of annual turnover');
    }
    
    return implications;
  }

  private assessFrameworkCompliance(breach: DataBreach, framework: ComplianceFramework): any {
    // Implement framework-specific compliance assessment
    return { status: 'compliant', details: 'Assessment pending' };
  }

  private initializeNotificationTemplates(): void {
    // Initialize default notification templates
    this.notificationTemplates.set('regulatory', {
      subject: 'Data Breach Notification - {{breachId}}',
      body: 'We are writing to notify you of a data breach incident...',
      format: 'formal'
    });

    this.notificationTemplates.set('data_subject', {
      subject: 'Important Security Notice',
      body: 'We are writing to inform you of a security incident...',
      format: 'user_friendly'
    });
  }

  private setupEscalationRules(): void {
    // Setup default escalation rules
    this.escalationRules.push({
      name: 'Critical Breach Auto-Escalation',
      severity: [BreachSeverity.CRITICAL],
      actions: [
        {
          type: 'notify_team',
          target: 'legal',
          message: 'Critical breach requires immediate legal review'
        },
        {
          type: 'notify_team',
          target: 'executive',
          message: 'Critical breach requires executive awareness'
        }
      ]
    });
  }

  private generateNotification(breach: DataBreach, template: NotificationTemplate, customMessage?: string): string {
    let notification = template.body;
    notification = notification.replace('{{breachId}}', breach.id);
    notification = notification.replace('{{title}}', breach.title);
    notification = notification.replace('{{affectedRecords}}', breach.affectedRecords.toString());
    
    if (customMessage) {
      notification += '\n\nAdditional Information:\n' + customMessage;
    }
    
    return notification;
  }

  private generatePersonalizedNotification(
    breach: DataBreach,
    template: NotificationTemplate,
    subject: { id: string; email: string; preferredLanguage?: string }
  ): string {
    // Implement personalized notification generation
    return this.generateNotification(breach, template);
  }

  private async sendNotification(contact: RegulatoryContact, notification: string): Promise<void> {
    // Implement actual notification sending (email, API, etc.)
    console.log(`Sending notification to ${contact.email}: ${notification}`);
  }

  private async sendDataSubjectNotification(
    subject: { id: string; email: string },
    notification: string
  ): Promise<void> {
    // Implement data subject notification sending
    console.log(`Sending notification to ${subject.email}: ${notification}`);
  }
}

// Supporting interfaces
interface NotificationTemplate {
  subject: string;
  body: string;
  format: 'formal' | 'user_friendly';
}

interface RegulatoryContact {
  jurisdiction: string;
  authority: string;
  email: string;
  phone?: string;
  submissionMethod: 'email' | 'web_portal' | 'api';
}

interface EscalationRule {
  name: string;
  severity?: BreachSeverity[];
  affectedRecordsThreshold?: number;
  dataTypes?: PersonalDataType[];
  actions: EscalationAction[];
}

interface EscalationAction {
  type: 'notify_team' | 'auto_contain' | 'external_notification';
  target: string;
  message?: string;
  delay?: number; // milliseconds
}

interface BreachAssessmentReport {
  breachId: string;
  generatedAt: string;
  summary: {
    title: string;
    severity: BreachSeverity;
    affectedRecords: number;
    duration?: number;
    status: string;
  };
  timeline: Array<{ timestamp: string; event: string; details?: string }>;
  impactAnalysis: any;
  complianceAssessment: any;
  mitigationActions: any[];
  lessonsLearned: string[];
  recommendations: string[];
}

interface BreachStatistics {
  totalBreaches: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byDataType: Record<string, number>;
  totalAffectedRecords: number;
  averageContainmentTime: number;
  averageResolutionTime: number;
  regulatoryReportingCompliance: number;
  timeframe: string;
  generatedAt: string;
}