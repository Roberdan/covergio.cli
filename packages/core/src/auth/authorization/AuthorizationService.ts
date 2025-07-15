/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Permission,
  Role,
  UserRole,
  AuthorizationContext,
  AuthorizationResult,
  AuthorizationPolicy,
  AuthorizationConfig,
  AuthorizationError,
  AuthorizationErrorType,
  BulkAuthorizationRequest,
  BulkAuthorizationResult,
  AuthorizationAuditLog,
  PermissionMatrix,
  RoleEffectivenessAnalysis
} from './types';
import { PermissionEngine } from './PermissionEngine';
import { RoleManager } from './RoleManager';

/**
 * Main authorization service that orchestrates RBAC and ABAC
 * 
 * Provides comprehensive authorization capabilities including:
 * - Role-based access control (RBAC)
 * - Attribute-based access control (ABAC)
 * - Policy-based authorization
 * - Permission inheritance and hierarchy
 * - Audit logging
 * - Bulk authorization checks
 * - Dynamic permission management
 */
export class AuthorizationService {
  private readonly permissionEngine: PermissionEngine;
  private readonly roleManager: RoleManager;
  private readonly policies: Map<string, AuthorizationPolicy> = new Map();
  private readonly auditLogs: AuthorizationAuditLog[] = [];
  private readonly config: Required<AuthorizationConfig>;

  constructor(
    config: AuthorizationConfig = {},
    permissionEngine?: PermissionEngine,
    roleManager?: RoleManager
  ) {
    this.config = {
      enableAttributeBasedAccess: true,
      enableRoleHierarchy: true,
      enablePolicyEngine: true,
      defaultDenyAll: true,
      cachePermissions: true,
      cacheTimeout: 300000, // 5 minutes
      auditEnabled: true,
      strictMode: true,
      maxRoleDepth: 10,
      ...config
    };

    this.permissionEngine = permissionEngine || new PermissionEngine(this.config.cacheTimeout);
    this.roleManager = roleManager || new RoleManager(this.config.maxRoleDepth);

    this.initializeDefaultPolicies();
  }

  /**
   * Check if user is authorized to perform action on resource
   * 
   * @param userId - User ID
   * @param resource - Resource identifier
   * @param action - Action to perform
   * @param context - Authorization context
   * @returns Authorization result
   */
  async authorize(
    userId: string,
    resource: string,
    action: string,
    context: AuthorizationContext
  ): Promise<AuthorizationResult> {
    const startTime = Date.now();
    let result: AuthorizationResult;

    try {
      // Validate input
      this.validateAuthorizationRequest(userId, resource, action, context);

      // Get user permissions through role system
      const userPermissions = await this.getUserEffectivePermissions(userId, context);

      // Check against permission engine
      result = await this.permissionEngine.checkPermission(
        userPermissions.effective,
        resource,
        action,
        context
      );

      // Apply policy engine if enabled
      if (this.config.enablePolicyEngine) {
        result = await this.applyPolicies(result, userId, resource, action, context);
      }

      // Default deny if no explicit grant
      if (this.config.defaultDenyAll && !result.granted && result.matchedPermissions.length === 0) {
        result = {
          granted: false,
          reason: 'Default deny - no explicit permissions found',
          matchedPermissions: [],
          appliedConditions: [],
          denyReasons: ['Default deny policy applied'],
          suggestions: ['Contact administrator to request appropriate permissions']
        };
      }

    } catch (error) {
      // Re-throw validation errors as they are fundamental input issues
      if (error instanceof Error && error.name === 'AuthorizationError') {
        const authError = error as AuthorizationError;
        if (authError.type === AuthorizationErrorType.INVALID_CONTEXT) {
          throw error;
        }
      }

      result = {
        granted: false,
        reason: `Authorization error: ${error instanceof Error ? error.message : String(error)}`,
        matchedPermissions: [],
        appliedConditions: [],
        denyReasons: [error instanceof Error ? error.message : String(error)]
      };
    }

    // Audit logging
    if (this.config.auditEnabled) {
      await this.logAuthorizationEvent(userId, resource, action, result, context, Date.now() - startTime);
    }

    return result;
  }

  /**
   * Perform bulk authorization checks
   * 
   * @param userId - User ID
   * @param request - Bulk authorization request
   * @returns Bulk authorization result
   */
  async bulkAuthorize(userId: string, request: BulkAuthorizationRequest): Promise<BulkAuthorizationResult> {
    const results: BulkAuthorizationResult['results'] = [];
    let granted = 0;
    let denied = 0;

    for (const check of request.checks) {
      const result = await this.authorize(
        userId,
        check.resource,
        check.action,
        request.context
      );

      results.push({
        resource: check.resource,
        action: check.action,
        granted: result.granted,
        reason: result.reason
      });

      if (result.granted) {
        granted++;
      } else {
        denied++;
      }
    }

    return {
      results,
      summary: {
        total: request.checks.length,
        granted,
        denied
      }
    };
  }

  /**
   * Create a new permission
   * 
   * @param permission - Permission to create
   * @returns Created permission
   */
  async createPermission(permission: Permission): Promise<Permission> {
    this.permissionEngine.registerPermission(permission);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('permission_created', permission.id, {
        permission: permission
      });
    }

    return permission;
  }

  /**
   * Create multiple permissions
   * 
   * @param permissions - Array of permissions to create
   * @returns Array of created permissions
   */
  async createPermissions(permissions: Permission[]): Promise<Permission[]> {
    this.permissionEngine.registerPermissions(permissions);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('permissions_created', 'bulk', {
        count: permissions.length,
        permissions: permissions.map(p => p.id)
      });
    }

    return permissions;
  }

  /**
   * Delete a permission
   * 
   * @param permissionId - Permission ID to delete
   */
  async deletePermission(permissionId: string): Promise<void> {
    this.permissionEngine.removePermission(permissionId);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('permission_deleted', permissionId);
    }
  }

  /**
   * Create a new role
   * 
   * @param role - Role to create
   * @returns Created role
   */
  async createRole(role: Role): Promise<Role> {
    const createdRole = await this.roleManager.createRole(role);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('role_created', role.id, {
        role: createdRole
      });
    }

    return createdRole;
  }

  /**
   * Update an existing role
   * 
   * @param roleId - Role ID to update
   * @param updates - Updates to apply
   * @returns Updated role
   */
  async updateRole(roleId: string, updates: Partial<Omit<Role, 'id' | 'createdAt'>>): Promise<Role> {
    const updatedRole = await this.roleManager.updateRole(roleId, updates);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('role_updated', roleId, {
        updates,
        role: updatedRole
      });
    }

    return updatedRole;
  }

  /**
   * Delete a role
   * 
   * @param roleId - Role ID to delete
   */
  async deleteRole(roleId: string): Promise<void> {
    await this.roleManager.deleteRole(roleId);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('role_deleted', roleId);
    }
  }

  /**
   * Assign role to user
   * 
   * @param userId - User ID
   * @param roleId - Role ID
   * @param assignedBy - ID of user who assigned the role
   * @param expiresAt - Optional expiration date
   * @returns User role assignment
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: string
  ): Promise<UserRole> {
    const userRole = await this.roleManager.assignRoleToUser(userId, roleId, assignedBy, expiresAt);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('role_assigned', `${userId}:${roleId}`, {
        userId,
        roleId,
        assignedBy,
        expiresAt,
        userRole
      });
    }

    return userRole;
  }

  /**
   * Remove role from user
   * 
   * @param userId - User ID
   * @param roleId - Role ID
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.roleManager.removeRoleFromUser(userId, roleId);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('role_removed', `${userId}:${roleId}`, {
        userId,
        roleId
      });
    }
  }

  /**
   * Get user's effective permissions
   * 
   * @param userId - User ID
   * @param context - Authorization context
   * @returns Permission inheritance details
   */
  async getUserEffectivePermissions(userId: string, context?: AuthorizationContext) {
    return await this.roleManager.getUserPermissions(userId, context);
  }

  /**
   * Get user's roles
   * 
   * @param userId - User ID
   * @param includeExpired - Include expired roles
   * @returns Array of user roles
   */
  getUserRoles(userId: string, includeExpired: boolean = false): UserRole[] {
    return this.roleManager.getUserRoles(userId, includeExpired);
  }

  /**
   * Get all roles
   * 
   * @returns Array of all roles
   */
  getAllRoles(): Role[] {
    return this.roleManager.getAllRoles();
  }

  /**
   * Get all permissions
   * 
   * @returns Array of all permissions
   */
  getAllPermissions(): Permission[] {
    return this.permissionEngine.getAllPermissions();
  }

  /**
   * Create authorization policy
   * 
   * @param policy - Policy to create
   * @returns Created policy
   */
  async createPolicy(policy: AuthorizationPolicy): Promise<AuthorizationPolicy> {
    if (this.policies.has(policy.id)) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.PERMISSION_DENIED,
        `Policy with ID '${policy.id}' already exists`
      );
    }

    const now = new Date().toISOString();
    const newPolicy: AuthorizationPolicy = {
      ...policy,
      createdAt: now,
      updatedAt: now
    };

    this.policies.set(policy.id, newPolicy);
    
    if (this.config.auditEnabled) {
      await this.logAdministrativeEvent('policy_created', policy.id, {
        policy: newPolicy
      });
    }

    return newPolicy;
  }

  /**
   * Get permission matrix for analysis
   * 
   * @returns Permission matrix
   */
  getPermissionMatrix(): PermissionMatrix {
    const roles = this.getAllRoles().map(role => ({
      id: role.id,
      name: role.name,
      permissions: role.permissions,
      level: 0 // Would be calculated from hierarchy
    }));

    const permissions = this.getAllPermissions().map(permission => ({
      id: permission.id,
      name: permission.name,
      resource: permission.resource,
      action: permission.action
    }));

    // Build matrix
    const matrix: boolean[][] = [];
    for (const role of roles) {
      const row: boolean[] = [];
      for (const permission of permissions) {
        row.push(role.permissions.includes(permission.id));
      }
      matrix.push(row);
    }

    return {
      roles,
      permissions,
      matrix
    };
  }

  /**
   * Analyze role effectiveness
   * 
   * @param roleId - Role ID to analyze
   * @returns Role effectiveness analysis
   */
  async analyzeRoleEffectiveness(roleId: string): Promise<RoleEffectivenessAnalysis> {
    const role = this.roleManager.getRole(roleId);
    if (!role) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.ROLE_NOT_FOUND,
        `Role '${roleId}' not found`
      );
    }

    const rolePermissions = await this.roleManager.getRolePermissions(roleId);
    
    return {
      roleId: role.id,
      roleName: role.name,
      directPermissions: rolePermissions.direct.length,
      inheritedPermissions: rolePermissions.inherited.length,
      totalEffectivePermissions: rolePermissions.effective.length,
      unusedPermissions: [], // Would require usage analytics
      conflictingPermissions: [], // Would require conflict detection
      recommendations: [
        'Review permission usage patterns',
        'Consider consolidating similar permissions',
        'Audit inherited permissions for redundancy'
      ]
    };
  }

  /**
   * Get audit logs
   * 
   * @param filters - Optional filters
   * @returns Array of audit logs
   */
  getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    result?: 'granted' | 'denied';
    startTime?: string;
    endTime?: string;
  }): AuthorizationAuditLog[] {
    let logs = [...this.auditLogs];

    if (filters) {
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }
      if (filters.result) {
        logs = logs.filter(log => log.result === filters.result);
      }
      if (filters.startTime) {
        logs = logs.filter(log => log.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        logs = logs.filter(log => log.timestamp <= filters.endTime!);
      }
    }

    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Clear authorization caches
   */
  clearCaches(): void {
    this.permissionEngine.clearCache();
    // Role manager has its own cache clearing
  }

  /**
   * Clear audit logs (for testing purposes)
   */
  clearAuditLogs(): void {
    this.auditLogs.length = 0;
  }

  /**
   * Get service statistics
   * 
   * @returns Service statistics
   */
  getStatistics() {
    const roleStats = this.roleManager.getStatistics();
    const permissionStats = this.permissionEngine.getCacheStats();

    return {
      roles: roleStats,
      permissions: {
        total: this.getAllPermissions().length,
        cacheSize: permissionStats.size
      },
      policies: {
        total: this.policies.size,
        active: Array.from(this.policies.values()).filter(p => p.isActive).length
      },
      auditLogs: {
        total: this.auditLogs.length,
        recent: this.auditLogs.filter(log => 
          Date.now() - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000
        ).length
      }
    };
  }

  /**
   * Apply authorization policies
   * 
   * @param result - Current authorization result
   * @param userId - User ID
   * @param resource - Resource identifier
   * @param action - Action
   * @param context - Authorization context
   * @returns Modified authorization result
   */
  private async applyPolicies(
    result: AuthorizationResult,
    userId: string,
    resource: string,
    action: string,
    context: AuthorizationContext
  ): Promise<AuthorizationResult> {
    const applicablePolicies = Array.from(this.policies.values())
      .filter(policy => 
        policy.isActive &&
        this.policyMatches(policy, resource, action)
      )
      .sort((a, b) => b.priority - a.priority);

    for (const policy of applicablePolicies) {
      if (await this.evaluatePolicy(policy, context)) {
        if (policy.effect === 'deny') {
          return {
            granted: false,
            reason: `Access denied by policy: ${policy.name}`,
            matchedPermissions: result.matchedPermissions,
            appliedConditions: result.appliedConditions,
            denyReasons: [`Policy '${policy.name}' explicitly denies access`]
          };
        }
        // Allow policies enhance the existing result
      }
    }

    return result;
  }

  /**
   * Check if policy matches resource and action
   * 
   * @param policy - Policy to check
   * @param resource - Resource identifier
   * @param action - Action
   * @returns True if policy matches
   */
  private policyMatches(policy: AuthorizationPolicy, resource: string, action: string): boolean {
    const resourceMatches = policy.resources.includes('*') || 
      policy.resources.some(r => resource.match(new RegExp(r.replace(/\*/g, '.*'))));
    
    const actionMatches = policy.actions.includes('*') || 
      policy.actions.includes(action);

    return resourceMatches && actionMatches;
  }

  /**
   * Evaluate policy conditions
   * 
   * @param policy - Policy to evaluate
   * @param context - Authorization context
   * @returns True if policy conditions are satisfied
   */
  private async evaluatePolicy(policy: AuthorizationPolicy, context: AuthorizationContext): Promise<boolean> {
    // Simplified policy evaluation - would be more complex in real implementation
    return policy.conditions.every(condition => {
      // Basic condition evaluation
      return true; // Placeholder
    });
  }

  /**
   * Validate authorization request
   * 
   * @param userId - User ID
   * @param resource - Resource identifier
   * @param action - Action
   * @param context - Authorization context
   */
  private validateAuthorizationRequest(
    userId: string,
    resource: string,
    action: string,
    context: AuthorizationContext
  ): void {
    if (!userId || userId.trim() === '') {
      throw this.createAuthorizationError(
        AuthorizationErrorType.INVALID_CONTEXT,
        'User ID is required'
      );
    }

    if (!resource || resource.trim() === '') {
      throw this.createAuthorizationError(
        AuthorizationErrorType.INVALID_CONTEXT,
        'Resource is required'
      );
    }

    if (!action || action.trim() === '') {
      throw this.createAuthorizationError(
        AuthorizationErrorType.INVALID_CONTEXT,
        'Action is required'
      );
    }

    if (!context.user?.id) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.INVALID_CONTEXT,
        'User context is required'
      );
    }

    if (this.config.strictMode && context.user.id !== userId) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.INVALID_CONTEXT,
        'User ID mismatch in context'
      );
    }
  }

  /**
   * Log authorization event
   * 
   * @param userId - User ID
   * @param resource - Resource identifier
   * @param action - Action
   * @param result - Authorization result
   * @param context - Authorization context
   * @param duration - Request duration in ms
   */
  private async logAuthorizationEvent(
    userId: string,
    resource: string,
    action: string,
    result: AuthorizationResult,
    context: AuthorizationContext,
    duration: number
  ): Promise<void> {
    const auditLog: AuthorizationAuditLog = {
      id: `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId,
      action,
      resource,
      result: result.granted ? 'granted' : 'denied',
      reason: result.reason,
      context,
      sessionId: context.session?.id,
      metadata: {
        duration,
        matchedPermissions: result.matchedPermissions,
        appliedConditions: result.appliedConditions.length,
        denyReasons: result.denyReasons
      }
    };

    this.auditLogs.push(auditLog);

    // Keep only last 10000 logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs.splice(0, this.auditLogs.length - 10000);
    }
  }

  /**
   * Log administrative event
   * 
   * @param action - Action performed
   * @param target - Target of the action
   * @param metadata - Additional metadata
   */
  private async logAdministrativeEvent(
    action: string,
    target: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const auditLog: AuthorizationAuditLog = {
      id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId: 'system',
      action,
      resource: target,
      result: 'granted',
      context: {
        user: { id: 'system' },
        action
      },
      metadata
    };

    this.auditLogs.push(auditLog);
  }

  /**
   * Initialize default policies
   */
  private initializeDefaultPolicies(): void {
    // Only create default deny policy if explicitly enabled and no other policies exist
    if (this.config.defaultDenyAll) {
      const defaultPolicies: AuthorizationPolicy[] = [
        {
          id: 'deny-all-default',
          name: 'Default Deny Policy',
          description: 'Default policy that denies all access unless explicitly granted',
          effect: 'deny',
          resources: ['*'],
          actions: ['*'],
          conditions: [],
          priority: -1000, // Very low priority so explicit policies override
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const policy of defaultPolicies) {
        this.policies.set(policy.id, policy);
      }
    }
  }

  /**
   * Create authorization error
   * 
   * @param type - Error type
   * @param message - Error message
   * @returns Authorization error
   */
  private createAuthorizationError(type: AuthorizationErrorType, message: string): AuthorizationError {
    const error = new Error(message) as AuthorizationError;
    error.name = 'AuthorizationError';
    error.type = type;
    return error;
  }
}