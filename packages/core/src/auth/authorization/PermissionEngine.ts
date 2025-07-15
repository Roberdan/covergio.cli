/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Permission,
  PermissionCondition,
  AuthorizationContext,
  AuthorizationResult,
  AuthorizationError,
  AuthorizationErrorType
} from './types';

/**
 * Permission evaluation engine
 * 
 * Handles fine-grained permission checking with support for:
 * - Attribute-based access control (ABAC)
 * - Conditional permissions
 * - Context-aware authorization
 * - Complex permission evaluation
 */
export class PermissionEngine {
  private readonly permissions: Map<string, Permission> = new Map();
  private readonly permissionCache: Map<string, AuthorizationResult> = new Map();
  private readonly cacheTimeout: number;

  constructor(cacheTimeout: number = 300000) { // 5 minutes default
    this.cacheTimeout = cacheTimeout;
    this.startCacheCleanup();
  }

  /**
   * Register a permission in the engine
   * 
   * @param permission - Permission to register
   */
  registerPermission(permission: Permission): void {
    this.permissions.set(permission.id, permission);
    this.clearRelatedCache(permission.resource, permission.action);
  }

  /**
   * Register multiple permissions
   * 
   * @param permissions - Array of permissions to register
   */
  registerPermissions(permissions: Permission[]): void {
    for (const permission of permissions) {
      this.registerPermission(permission);
    }
  }

  /**
   * Remove a permission from the engine
   * 
   * @param permissionId - ID of permission to remove
   */
  removePermission(permissionId: string): void {
    const permission = this.permissions.get(permissionId);
    if (permission) {
      this.permissions.delete(permissionId);
      this.clearRelatedCache(permission.resource, permission.action);
    }
  }

  /**
   * Get all registered permissions
   * 
   * @returns Array of all permissions
   */
  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Get permission by ID
   * 
   * @param permissionId - Permission ID
   * @returns Permission or undefined
   */
  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  /**
   * Find permissions by resource and action
   * 
   * @param resource - Resource identifier
   * @param action - Action to perform
   * @returns Array of matching permissions
   */
  findPermissions(resource: string, action: string): Permission[] {
    return this.getAllPermissions().filter(permission => 
      this.matchesResourceAndAction(permission, resource, action)
    );
  }

  /**
   * Check if user has permission for specific action on resource
   * 
   * @param userPermissions - Array of permission IDs user has
   * @param resource - Resource identifier
   * @param action - Action to perform
   * @param context - Authorization context
   * @returns Authorization result
   */
  async checkPermission(
    userPermissions: string[],
    resource: string,
    action: string,
    context: AuthorizationContext
  ): Promise<AuthorizationResult> {
    // Generate cache key
    const cacheKey = this.generateCacheKey(userPermissions, resource, action, context);
    
    // Check cache first
    const cached = this.permissionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.evaluatePermission(userPermissions, resource, action, context);
      
      // Cache the result
      this.permissionCache.set(cacheKey, result);
      setTimeout(() => this.permissionCache.delete(cacheKey), this.cacheTimeout);
      
      return result;
    } catch (error) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.PERMISSION_DENIED,
        `Permission evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        context,
        resource,
        action
      );
    }
  }

  /**
   * Check multiple permissions in batch
   * 
   * @param userPermissions - Array of permission IDs user has
   * @param checks - Array of resource/action pairs to check
   * @param context - Authorization context
   * @returns Array of authorization results
   */
  async checkMultiplePermissions(
    userPermissions: string[],
    checks: Array<{ resource: string; action: string }>,
    context: AuthorizationContext
  ): Promise<AuthorizationResult[]> {
    const results: AuthorizationResult[] = [];
    
    for (const check of checks) {
      const result = await this.checkPermission(
        userPermissions,
        check.resource,
        check.action,
        context
      );
      results.push(result);
    }
    
    return results;
  }

  /**
   * Evaluate condition against context
   * 
   * @param condition - Permission condition to evaluate
   * @param context - Authorization context
   * @returns True if condition is satisfied
   */
  evaluateCondition(condition: PermissionCondition, context: AuthorizationContext): boolean {
    try {
      const value = this.extractContextValue(condition.attribute, condition.context, context);
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'not_equals':
          return value !== condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(value);
        case 'not_in':
          return Array.isArray(condition.value) && !condition.value.includes(value);
        case 'greater_than':
          return typeof value === 'number' && value > condition.value;
        case 'less_than':
          return typeof value === 'number' && value < condition.value;
        case 'contains':
          return typeof value === 'string' && value.includes(condition.value);
        case 'regex':
          return typeof value === 'string' && new RegExp(condition.value).test(value);
        default:
          return false;
      }
    } catch (error) {
      console.warn(`Condition evaluation failed for ${condition.attribute}:`, error);
      return false;
    }
  }

  /**
   * Get effective permissions for user
   * 
   * @param userPermissions - User's permission IDs
   * @param context - Authorization context
   * @returns Array of effective permissions after condition evaluation
   */
  async getEffectivePermissions(
    userPermissions: string[],
    context: AuthorizationContext
  ): Promise<Permission[]> {
    const effectivePermissions: Permission[] = [];
    
    for (const permissionId of userPermissions) {
      const permission = this.permissions.get(permissionId);
      if (!permission) continue;
      
      // Check if all conditions are satisfied
      if (await this.evaluatePermissionConditions(permission, context)) {
        effectivePermissions.push(permission);
      }
    }
    
    return effectivePermissions;
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.permissionCache.size,
      // Hit rate calculation would require tracking hits/misses
    };
  }

  /**
   * Evaluate permission for specific resource and action
   * 
   * @param userPermissions - User's permission IDs
   * @param resource - Resource identifier
   * @param action - Action to perform
   * @param context - Authorization context
   * @returns Authorization result
   */
  private async evaluatePermission(
    userPermissions: string[],
    resource: string,
    action: string,
    context: AuthorizationContext
  ): Promise<AuthorizationResult> {
    const matchedPermissions: string[] = [];
    const appliedConditions: PermissionCondition[] = [];
    const denyReasons: string[] = [];

    // Find permissions that match the resource and action
    const candidatePermissions = this.findPermissions(resource, action);
    
    for (const permission of candidatePermissions) {
      // Check if user has this permission
      if (!userPermissions.includes(permission.id)) {
        continue;
      }

      // Evaluate permission conditions
      if (await this.evaluatePermissionConditions(permission, context)) {
        matchedPermissions.push(permission.id);
        if (permission.conditions) {
          appliedConditions.push(...permission.conditions);
        }
      } else {
        denyReasons.push(`Permission ${permission.id} conditions not satisfied`);
      }
    }

    const granted = matchedPermissions.length > 0;
    
    return {
      granted,
      reason: granted 
        ? `Access granted via permissions: ${matchedPermissions.join(', ')}`
        : `Access denied: ${denyReasons.join('; ') || 'No matching permissions found'}`,
      matchedPermissions,
      appliedConditions,
      denyReasons: granted ? undefined : denyReasons,
      suggestions: granted ? undefined : this.generateSuggestions(resource, action)
    };
  }

  /**
   * Evaluate all conditions for a permission
   * 
   * @param permission - Permission to evaluate
   * @param context - Authorization context
   * @returns True if all conditions are satisfied
   */
  private async evaluatePermissionConditions(
    permission: Permission,
    context: AuthorizationContext
  ): Promise<boolean> {
    if (!permission.conditions || permission.conditions.length === 0) {
      return true;
    }

    for (const condition of permission.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if permission matches resource and action
   * 
   * @param permission - Permission to check
   * @param resource - Resource identifier
   * @param action - Action to perform
   * @returns True if permission matches
   */
  private matchesResourceAndAction(permission: Permission, resource: string, action: string): boolean {
    // Exact match
    if (permission.resource === resource && permission.action === action) {
      return true;
    }

    // Wildcard matching
    if (permission.resource === '*' || permission.action === '*') {
      return true;
    }

    // Pattern matching (simple implementation)
    const resourcePattern = new RegExp(permission.resource.replace(/\*/g, '.*'));
    const actionPattern = new RegExp(permission.action.replace(/\*/g, '.*'));
    
    return resourcePattern.test(resource) && actionPattern.test(action);
  }

  /**
   * Extract value from context based on attribute path
   * 
   * @param attribute - Attribute path (e.g., 'user.department')
   * @param contextType - Context type
   * @param context - Authorization context
   * @returns Extracted value
   */
  private extractContextValue(
    attribute: string,
    contextType: string | undefined,
    context: AuthorizationContext
  ): any {
    const parts = attribute.split('.');
    let value: any;

    switch (contextType) {
      case 'user':
        value = context.user;
        break;
      case 'resource':
        value = context.resource;
        break;
      case 'environment':
        value = context.environment;
        break;
      case 'session':
        value = context.session;
        break;
      default:
        // Try to find in any context
        value = context.user || context.resource || context.environment || context.session;
    }

    // Navigate through object path
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Generate cache key for permission check
   * 
   * @param userPermissions - User permissions
   * @param resource - Resource identifier
   * @param action - Action to perform
   * @param context - Authorization context
   * @returns Cache key
   */
  private generateCacheKey(
    userPermissions: string[],
    resource: string,
    action: string,
    context: AuthorizationContext
  ): string {
    const permissionsHash = userPermissions.sort().join(',');
    const contextHash = JSON.stringify({
      user: context.user,
      resource: context.resource,
      environment: context.environment,
      session: context.session
    });
    
    return `${permissionsHash}:${resource}:${action}:${btoa(contextHash)}`;
  }

  /**
   * Clear cache entries related to specific resource/action
   * 
   * @param resource - Resource identifier
   * @param action - Action
   */
  private clearRelatedCache(resource: string, action: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.permissionCache.keys()) {
      if (key.includes(`:${resource}:${action}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.permissionCache.delete(key);
    }
  }

  /**
   * Generate suggestions for denied access
   * 
   * @param resource - Resource identifier
   * @param action - Action attempted
   * @returns Array of suggestions
   */
  private generateSuggestions(resource: string, action: string): string[] {
    const suggestions: string[] = [];
    
    // Find similar permissions
    const similarPermissions = this.getAllPermissions().filter(p => 
      p.resource.includes(resource) || p.action.includes(action)
    );
    
    if (similarPermissions.length > 0) {
      suggestions.push(`Consider requesting one of these permissions: ${similarPermissions.map(p => p.name).join(', ')}`);
    }
    
    // Check for common patterns
    if (action === 'write' || action === 'update') {
      suggestions.push('Try requesting read permission first, then escalate to write permissions');
    }
    
    if (resource.includes('/')) {
      const parentResource = resource.substring(0, resource.lastIndexOf('/'));
      suggestions.push(`Check if you have permissions for parent resource: ${parentResource}`);
    }
    
    return suggestions;
  }

  /**
   * Create authorization error
   * 
   * @param type - Error type
   * @param message - Error message
   * @param context - Authorization context
   * @param resource - Resource identifier
   * @param action - Action attempted
   * @returns Authorization error
   */
  private createAuthorizationError(
    type: AuthorizationErrorType,
    message: string,
    context?: AuthorizationContext,
    resource?: string,
    action?: string
  ): AuthorizationError {
    const error = new Error(message) as AuthorizationError;
    error.name = 'AuthorizationError';
    error.type = type;
    error.context = context;
    error.resource = resource;
    error.action = action;
    return error;
  }

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanup(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      // In a real implementation, you'd track entry timestamps
      // For now, we rely on individual entry timeouts
    }, 5 * 60 * 1000);
  }
}