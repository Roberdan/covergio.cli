/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './types';
export { PermissionEngine } from './PermissionEngine';
export { RoleManager } from './RoleManager';
export { AuthorizationService } from './AuthorizationService';

// Re-export commonly used types for convenience
export type {
  Permission,
  Role,
  UserRole,
  AuthorizationContext,
  AuthorizationResult,
  AuthorizationConfig,
  AuthorizationPolicy,
  BulkAuthorizationRequest,
  BulkAuthorizationResult,
  AuthorizationAuditLog,
  PermissionMatrix,
  RoleEffectivenessAnalysis
} from './types';