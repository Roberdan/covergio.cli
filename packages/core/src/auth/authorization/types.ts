/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Permission represents a specific action that can be performed on a resource
 */
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
  metadata?: Record<string, any>;
}

/**
 * Condition for attribute-based access control (ABAC)
 */
export interface PermissionCondition {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'contains' | 'regex';
  value: any;
  context?: 'user' | 'resource' | 'environment' | 'session';
}

/**
 * Role defines a collection of permissions
 */
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Permission IDs
  inheritFrom?: string[]; // Parent role IDs for hierarchy
  isSystem?: boolean; // System roles cannot be deleted
  conditions?: RoleCondition[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Condition for role assignment
 */
export interface RoleCondition {
  attribute: string;
  operator: string;
  value: any;
  context: 'user' | 'session' | 'environment';
}

/**
 * User assignment to roles
 */
export interface UserRole {
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
  conditions?: UserRoleCondition[];
  isActive: boolean;
}

/**
 * Condition for user role assignment
 */
export interface UserRoleCondition {
  type: 'time_based' | 'location_based' | 'session_based' | 'custom';
  expression: string;
  parameters?: Record<string, any>;
}

/**
 * Authorization context for permission checks
 */
export interface AuthorizationContext {
  user: {
    id: string;
    attributes?: Record<string, any>;
    groups?: string[];
    department?: string;
    location?: string;
  };
  resource?: {
    id: string;
    type: string;
    owner?: string;
    attributes?: Record<string, any>;
  };
  action: string;
  environment?: {
    ip?: string;
    userAgent?: string;
    time?: string;
    location?: string;
  };
  session?: {
    id: string;
    createdAt: string;
    mfaVerified?: boolean;
    riskScore?: number;
  };
}

/**
 * Result of authorization check
 */
export interface AuthorizationResult {
  granted: boolean;
  reason?: string;
  matchedPermissions: string[];
  appliedConditions: PermissionCondition[];
  denyReasons?: string[];
  suggestions?: string[];
}

/**
 * Policy for complex authorization rules
 */
export interface AuthorizationPolicy {
  id: string;
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  resources: string[];
  actions: string[];
  conditions: PolicyCondition[];
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Policy condition for fine-grained control
 */
export interface PolicyCondition {
  field: string;
  operator: string;
  value: any;
  context: 'user' | 'resource' | 'environment' | 'session';
}

/**
 * Resource definition for authorization
 */
export interface AuthorizationResource {
  id: string;
  type: string;
  name: string;
  description: string;
  actions: string[];
  attributes?: Record<string, any>;
  parentResource?: string;
  isProtected?: boolean;
}

/**
 * Audit log entry for authorization events
 */
export interface AuthorizationAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource?: string;
  resourceType?: string;
  result: 'granted' | 'denied';
  reason?: string;
  context: AuthorizationContext;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Role hierarchy node
 */
export interface RoleHierarchyNode {
  role: Role;
  children: RoleHierarchyNode[];
  parent?: RoleHierarchyNode;
  level: number;
  effectivePermissions: string[];
}

/**
 * Permission inheritance result
 */
export interface PermissionInheritance {
  direct: string[];
  inherited: Array<{
    permission: string;
    inheritedFrom: string;
    path: string[];
  }>;
  effective: string[];
}

/**
 * Authorization service configuration
 */
export interface AuthorizationConfig {
  enableAttributeBasedAccess?: boolean;
  enableRoleHierarchy?: boolean;
  enablePolicyEngine?: boolean;
  defaultDenyAll?: boolean;
  cachePermissions?: boolean;
  cacheTimeout?: number;
  auditEnabled?: boolean;
  strictMode?: boolean;
  maxRoleDepth?: number;
}

/**
 * Authorization error types
 */
export enum AuthorizationErrorType {
  PERMISSION_DENIED = 'permission_denied',
  ROLE_NOT_FOUND = 'role_not_found',
  PERMISSION_NOT_FOUND = 'permission_not_found',
  INVALID_CONTEXT = 'invalid_context',
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  MAX_DEPTH_EXCEEDED = 'max_depth_exceeded',
  POLICY_EVALUATION_ERROR = 'policy_evaluation_error',
  CONDITION_EVALUATION_ERROR = 'condition_evaluation_error'
}

/**
 * Authorization error
 */
export interface AuthorizationError extends Error {
  type: AuthorizationErrorType;
  context?: AuthorizationContext;
  resource?: string;
  action?: string;
  details?: Record<string, any>;
}

/**
 * Bulk authorization request
 */
export interface BulkAuthorizationRequest {
  context: AuthorizationContext;
  checks: Array<{
    resource: string;
    action: string;
    resourceType?: string;
  }>;
}

/**
 * Bulk authorization result
 */
export interface BulkAuthorizationResult {
  results: Array<{
    resource: string;
    action: string;
    granted: boolean;
    reason?: string;
  }>;
  summary: {
    total: number;
    granted: number;
    denied: number;
  };
}

/**
 * Permission matrix for role analysis
 */
export interface PermissionMatrix {
  roles: Array<{
    id: string;
    name: string;
    permissions: string[];
    level: number;
  }>;
  permissions: Array<{
    id: string;
    name: string;
    resource: string;
    action: string;
  }>;
  matrix: boolean[][]; // roles x permissions
}

/**
 * Role effectiveness analysis
 */
export interface RoleEffectivenessAnalysis {
  roleId: string;
  roleName: string;
  directPermissions: number;
  inheritedPermissions: number;
  totalEffectivePermissions: number;
  unusedPermissions: string[];
  conflictingPermissions: string[];
  recommendations: string[];
}