/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Data classification levels for compliance
 */
export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  PII = 'pii', // Personally Identifiable Information
  PHI = 'phi', // Protected Health Information
  PCI = 'pci'  // Payment Card Industry
}

/**
 * Supported compliance frameworks
 */
export enum ComplianceFramework {
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  CCPA = 'ccpa',
  SOX = 'sox',
  PCI_DSS = 'pci_dss',
  ISO_27001 = 'iso_27001',
  NIST = 'nist'
}

/**
 * Data subject rights under various privacy regulations
 */
export enum DataSubjectRights {
  ACCESS = 'access',                    // Right to access personal data
  RECTIFICATION = 'rectification',      // Right to correct inaccurate data
  ERASURE = 'erasure',                  // Right to be forgotten
  PORTABILITY = 'portability',          // Right to data portability
  RESTRICTION = 'restriction',          // Right to restrict processing
  OBJECTION = 'objection',              // Right to object to processing
  AUTOMATED_DECISION = 'automated_decision' // Rights related to automated decision-making
}

/**
 * Types of personal data for classification
 */
export enum PersonalDataType {
  DIRECT_IDENTIFIER = 'direct_identifier',     // Name, SSN, etc.
  QUASI_IDENTIFIER = 'quasi_identifier',       // ZIP code, age, etc.
  SENSITIVE_DATA = 'sensitive_data',           // Health, religion, etc.
  BEHAVIORAL_DATA = 'behavioral_data',         // Usage patterns, preferences
  BIOMETRIC_DATA = 'biometric_data',           // Fingerprints, facial recognition
  FINANCIAL_DATA = 'financial_data',           // Credit card, bank account
  LOCATION_DATA = 'location_data',             // GPS, IP geolocation
  COMMUNICATION_DATA = 'communication_data'     // Emails, messages
}

/**
 * Consent status and types
 */
export enum ConsentStatus {
  GIVEN = 'given',
  WITHDRAWN = 'withdrawn',
  PENDING = 'pending',
  EXPIRED = 'expired',
  REFUSED = 'refused'
}

export enum ConsentType {
  EXPLICIT = 'explicit',      // Explicit consent (opt-in)
  IMPLIED = 'implied',        // Implied consent
  LEGITIMATE_INTEREST = 'legitimate_interest'
}

/**
 * Data processing purposes
 */
export enum ProcessingPurpose {
  SERVICE_PROVISION = 'service_provision',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  RESEARCH = 'research',
  LEGAL_COMPLIANCE = 'legal_compliance',
  SECURITY = 'security',
  FRAUD_PREVENTION = 'fraud_prevention'
}

/**
 * Data breach severity levels
 */
export enum BreachSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Data retention policies
 */
export interface DataRetentionPolicy {
  id: string;
  name: string;
  description: string;
  dataTypes: PersonalDataType[];
  retentionPeriod: number; // days
  autoDelete: boolean;
  archiveAfter?: number; // days
  legalBasis: string;
  reviewDate: string;
  approvedBy: string;
}

/**
 * Data subject information
 */
export interface DataSubject {
  id: string;
  identifier: string; // email, user ID, etc.
  identifierType: 'email' | 'user_id' | 'phone' | 'other';
  dataClassifications: DataClassification[];
  jurisdiction: string; // Country/region for determining applicable laws
  registrationDate: string;
  lastActivity?: string;
  status: 'active' | 'inactive' | 'deleted';
}

/**
 * Consent record
 */
export interface ConsentRecord {
  id: string;
  dataSubjectId: string;
  purpose: ProcessingPurpose;
  consentType: ConsentType;
  status: ConsentStatus;
  grantedAt?: string;
  withdrawnAt?: string;
  expiresAt?: string;
  legalBasis: string;
  version: string; // Version of privacy policy/terms
  ipAddress?: string;
  userAgent?: string;
  method: 'web_form' | 'api' | 'email' | 'phone' | 'in_person';
  evidence?: string; // Additional evidence of consent
}

/**
 * Data subject access request (DSAR)
 */
export interface DataSubjectRequest {
  id: string;
  requestType: DataSubjectRights;
  dataSubjectId: string;
  requesterId?: string; // If different from data subject
  description: string;
  submittedAt: string;
  verifiedAt?: string;
  processedAt?: string;
  completedAt?: string;
  status: 'submitted' | 'verification_pending' | 'verified' | 'processing' | 'completed' | 'rejected';
  rejectionReason?: string;
  responseData?: any;
  verificationMethod?: string;
  assignedTo?: string;
  deadline: string; // Legal deadline for response
  metadata?: Record<string, any>;
}

/**
 * Data anonymization configuration
 */
export interface AnonymizationConfig {
  technique: 'k_anonymity' | 'l_diversity' | 'differential_privacy' | 'pseudonymization' | 'generalization';
  parameters: Record<string, any>;
  reversible: boolean;
  keyManagement?: {
    keyId: string;
    rotationPolicy: string;
  };
}

/**
 * Anonymized data record
 */
export interface AnonymizedData {
  id: string;
  originalId?: string; // If pseudonymization
  dataType: PersonalDataType;
  anonymizationMethod: string;
  anonymizedAt: string;
  anonymizedBy: string;
  config: AnonymizationConfig;
  qualityMetrics?: {
    utilityScore: number;
    privacyScore: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

/**
 * Data breach incident
 */
export interface DataBreach {
  id: string;
  title: string;
  description: string;
  severity: BreachSeverity;
  discoveredAt: string;
  reportedAt?: string;
  containedAt?: string;
  resolvedAt?: string;
  affectedRecords: number;
  affectedDataTypes: PersonalDataType[];
  affectedJurisdictions: string[];
  rootCause: string;
  impact: string;
  mitigationActions: string[];
  notificationRequired: boolean;
  notificationDeadline?: string;
  regulatoryReported: boolean;
  reportedTo?: string[];
  status: 'discovered' | 'investigating' | 'contained' | 'resolved' | 'closed';
  assignedTo: string;
  metadata?: Record<string, any>;
}

/**
 * Privacy impact assessment
 */
export interface PrivacyImpactAssessment {
  id: string;
  projectName: string;
  description: string;
  dataTypes: PersonalDataType[];
  processingPurposes: ProcessingPurpose[];
  legalBasis: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  mitigationMeasures: string[];
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: string;
  reviewDate: string;
  status: 'draft' | 'review' | 'approved' | 'rejected';
  assessor: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Compliance audit record
 */
export interface ComplianceAudit {
  id: string;
  framework: ComplianceFramework;
  auditType: 'internal' | 'external' | 'regulatory';
  startDate: string;
  endDate?: string;
  auditor: string;
  scope: string[];
  findings: ComplianceFindings[];
  overallScore?: number;
  recommendations: string[];
  status: 'planning' | 'in_progress' | 'completed' | 'follow_up_required';
  reportPath?: string;
  nextAuditDate?: string;
}

/**
 * Compliance finding
 */
export interface ComplianceFindings {
  id: string;
  control: string;
  requirement: string;
  finding: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  remediation: string;
  assignedTo?: string;
  dueDate?: string;
  resolvedAt?: string;
  evidence?: string[];
}

/**
 * Data processing record (Article 30 GDPR)
 */
export interface ProcessingRecord {
  id: string;
  controllerName: string;
  controllerContact: string;
  processingPurposes: ProcessingPurpose[];
  dataSubjectCategories: string[];
  personalDataCategories: PersonalDataType[];
  recipients: string[];
  thirdCountryTransfers?: {
    countries: string[];
    safeguards: string;
  };
  retentionPeriods: string;
  securityMeasures: string[];
  legalBasis: string;
  lastUpdated: string;
  nextReview: string;
}

/**
 * Cookie and tracking consent
 */
export interface CookieConsent {
  id: string;
  dataSubjectId: string;
  consentId: string;
  cookieCategories: {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
    personalization: boolean;
    functional: boolean;
  };
  grantedAt: string;
  expiresAt: string;
  version: string;
  bannerShown: boolean;
  choices: Record<string, boolean>;
}

/**
 * Cross-border data transfer record
 */
export interface DataTransfer {
  id: string;
  fromCountry: string;
  toCountry: string;
  dataTypes: PersonalDataType[];
  transferMechanism: 'adequacy_decision' | 'standard_contractual_clauses' | 'binding_corporate_rules' | 'certification' | 'other';
  safeguards: string[];
  purpose: string;
  recipient: string;
  dataSubjectCount: number;
  transferDate: string;
  approvedBy: string;
  reviewDate: string;
  documentation: string[];
}

/**
 * Compliance configuration
 */
export interface ComplianceConfig {
  enabledFrameworks: ComplianceFramework[];
  defaultJurisdiction: string;
  dataRetentionPolicies: DataRetentionPolicy[];
  automaticDeletion: boolean;
  breachNotificationEnabled: boolean;
  breachNotificationDeadline: number; // hours
  regulatoryContacts: Record<string, string>;
  dpoContact?: string; // Data Protection Officer
  privacyOfficerContact?: string;
  auditSettings: {
    frequency: number; // months
    autoSchedule: boolean;
    notificationDays: number;
  };
}

/**
 * Data export format options
 */
export interface DataExportOptions {
  format: 'json' | 'xml' | 'csv' | 'pdf';
  includeMetadata: boolean;
  includeAuditTrail: boolean;
  anonymize: boolean;
  compression: boolean;
  encryption?: {
    enabled: boolean;
    algorithm: string;
    password?: string;
  };
  digitalSignature: boolean;
}

/**
 * Data subject dashboard data
 */
export interface DataSubjectDashboard {
  dataSubject: DataSubject;
  activeConsents: ConsentRecord[];
  dataCategories: PersonalDataType[];
  processingPurposes: ProcessingPurpose[];
  retentionPolicies: DataRetentionPolicy[];
  pendingRequests: DataSubjectRequest[];
  dataUsageSummary: {
    lastAccessed: string;
    accessCount: number;
    dataVolume: string;
  };
  privacyScore: number;
  recommendations: string[];
}