/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Role,
  UserRole,
  RoleHierarchyNode,
  PermissionInheritance,
  AuthorizationError,
  AuthorizationErrorType,
  AuthorizationContext
} from './types';

/**
 * Role management system with hierarchy support
 * 
 * Provides comprehensive role management including:
 * - Role hierarchy with inheritance
 * - Dynamic role assignment
 * - Permission aggregation
 * - Circular dependency detection
 * - Role effectiveness analysis
 */
export class RoleManager {
  private readonly roles: Map<string, Role> = new Map();
  private readonly userRoles: Map<string, UserRole[]> = new Map();
  private readonly roleHierarchy: Map<string, RoleHierarchyNode> = new Map();
  private readonly maxDepth: number;
  private hierarchyCache: Map<string, PermissionInheritance> = new Map();

  constructor(maxDepth: number = 10) {
    this.maxDepth = maxDepth;
    this.initializeSystemRoles();
  }

  /**
   * Create a new role
   * 
   * @param role - Role to create
   * @returns Created role
   */
  async createRole(role: Role): Promise<Role> {
    if (this.roles.has(role.id)) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.ROLE_NOT_FOUND,
        `Role with ID '${role.id}' already exists`
      );
    }

    // Validate parent roles exist
    if (role.inheritFrom) {
      for (const parentId of role.inheritFrom) {
        if (!this.roles.has(parentId)) {
          throw this.createAuthorizationError(
            AuthorizationErrorType.ROLE_NOT_FOUND,
            `Parent role '${parentId}' not found`
          );
        }
      }

      // Check for circular dependencies
      if (this.wouldCreateCircularDependency(role.id, role.inheritFrom)) {
        throw this.createAuthorizationError(
          AuthorizationErrorType.CIRCULAR_DEPENDENCY,
          'Role inheritance would create circular dependency'
        );
      }
    }

    const now = new Date().toISOString();
    const newRole: Role = {
      ...role,
      createdAt: now,
      updatedAt: now
    };

    this.roles.set(role.id, newRole);
    this.rebuildHierarchy();
    this.clearHierarchyCache();

    return newRole;
  }

  /**
   * Update an existing role
   * 
   * @param roleId - Role ID to update
   * @param updates - Updates to apply
   * @returns Updated role
   */
  async updateRole(roleId: string, updates: Partial<Omit<Role, 'id' | 'createdAt'>>): Promise<Role> {
    const existingRole = this.roles.get(roleId);
    if (!existingRole) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.ROLE_NOT_FOUND,
        `Role '${roleId}' not found`
      );
    }

    if (existingRole.isSystem && (updates.inheritFrom || updates.permissions)) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.PERMISSION_DENIED,
        'Cannot modify permissions or inheritance of system roles'
      );
    }

    // Validate new parent roles if changing inheritance
    if (updates.inheritFrom) {
      for (const parentId of updates.inheritFrom) {
        if (!this.roles.has(parentId)) {
          throw this.createAuthorizationError(
            AuthorizationErrorType.ROLE_NOT_FOUND,
            `Parent role '${parentId}' not found`
          );
        }
      }

      // Check for circular dependencies
      if (this.wouldCreateCircularDependency(roleId, updates.inheritFrom)) {
        throw this.createAuthorizationError(
          AuthorizationErrorType.CIRCULAR_DEPENDENCY,
          'Role inheritance would create circular dependency'
        );
      }
    }

    const updatedRole: Role = {
      ...existingRole,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.roles.set(roleId, updatedRole);
    this.rebuildHierarchy();
    this.clearHierarchyCache();

    return updatedRole;
  }

  /**
   * Delete a role
   * 
   * @param roleId - Role ID to delete
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.ROLE_NOT_FOUND,
        `Role '${roleId}' not found`
      );
    }

    if (role.isSystem) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.PERMISSION_DENIED,
        'Cannot delete system roles'
      );
    }

    // Check if role is inherited by other roles
    const dependentRoles = this.findDependentRoles(roleId);
    if (dependentRoles.length > 0) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.PERMISSION_DENIED,
        `Cannot delete role '${roleId}' - it is inherited by: ${dependentRoles.join(', ')}`
      );
    }

    // Remove role assignments
    for (const [userId, userRoleList] of this.userRoles.entries()) {
      const filteredRoles = userRoleList.filter(ur => ur.roleId !== roleId);
      if (filteredRoles.length !== userRoleList.length) {
        this.userRoles.set(userId, filteredRoles);
      }
    }

    this.roles.delete(roleId);
    this.rebuildHierarchy();
    this.clearHierarchyCache();
  }

  /**
   * Get role by ID
   * 
   * @param roleId - Role ID
   * @returns Role or undefined
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  /**
   * Get all roles
   * 
   * @returns Array of all roles
   */
  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
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
  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: string
  ): Promise<UserRole> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.ROLE_NOT_FOUND,
        `Role '${roleId}' not found`
      );
    }

    const userRoleList = this.userRoles.get(userId) || [];
    
    // Check if user already has this role
    const existingAssignment = userRoleList.find(ur => ur.roleId === roleId && ur.isActive);
    if (existingAssignment) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.PERMISSION_DENIED,
        `User already has role '${roleId}'`
      );
    }

    const userRole: UserRole = {
      userId,
      roleId,
      assignedBy,
      assignedAt: new Date().toISOString(),
      expiresAt,
      isActive: true
    };

    userRoleList.push(userRole);
    this.userRoles.set(userId, userRoleList);

    return userRole;
  }

  /**
   * Remove role from user
   * 
   * @param userId - User ID
   * @param roleId - Role ID
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const userRoleList = this.userRoles.get(userId) || [];
    const filteredRoles = userRoleList.map(ur => 
      ur.roleId === roleId ? { ...ur, isActive: false } : ur
    );
    
    this.userRoles.set(userId, filteredRoles);
  }

  /**
   * Get user's roles
   * 
   * @param userId - User ID
   * @param includeExpired - Include expired roles
   * @returns Array of user roles
   */
  getUserRoles(userId: string, includeExpired: boolean = false): UserRole[] {
    const userRoleList = this.userRoles.get(userId) || [];
    const now = new Date().toISOString();

    return userRoleList.filter(ur => {
      if (!ur.isActive) return false;
      if (!includeExpired && ur.expiresAt && ur.expiresAt < now) return false;
      return true;
    });
  }

  /**
   * Get user's effective permissions
   * 
   * @param userId - User ID
   * @param context - Authorization context
   * @returns Permission inheritance with direct and inherited permissions
   */
  async getUserPermissions(userId: string, context?: AuthorizationContext): Promise<PermissionInheritance> {
    const cacheKey = `${userId}:${context ? JSON.stringify(context) : 'no-context'}`;
    const cached = this.hierarchyCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const userRoles = this.getUserRoles(userId);
    const directPermissions: string[] = [];
    const inheritedPermissions: Array<{
      permission: string;
      inheritedFrom: string;
      path: string[];
    }> = [];

    // Collect permissions from all user roles
    for (const userRole of userRoles) {
      const rolePermissions = await this.getRolePermissions(userRole.roleId);
      
      // Add direct permissions
      directPermissions.push(...rolePermissions.direct);
      
      // Add inherited permissions
      inheritedPermissions.push(...rolePermissions.inherited);
    }

    // Remove duplicates
    const uniqueDirectPermissions = [...new Set(directPermissions)];
    const uniqueInheritedPermissions = inheritedPermissions.filter((item, index, self) =>
      index === self.findIndex(other => other.permission === item.permission)
    );

    const allEffective = [...new Set([
      ...uniqueDirectPermissions,
      ...uniqueInheritedPermissions.map(item => item.permission)
    ])];

    const result: PermissionInheritance = {
      direct: uniqueDirectPermissions,
      inherited: uniqueInheritedPermissions,
      effective: allEffective
    };

    // Cache the result
    this.hierarchyCache.set(cacheKey, result);
    setTimeout(() => this.hierarchyCache.delete(cacheKey), 300000); // 5 minutes

    return result;
  }

  /**
   * Get role permissions including inherited ones
   * 
   * @param roleId - Role ID
   * @returns Permission inheritance for the role
   */
  async getRolePermissions(roleId: string): Promise<PermissionInheritance> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.ROLE_NOT_FOUND,
        `Role '${roleId}' not found`
      );
    }

    const directPermissions = [...role.permissions];
    const inheritedPermissions: Array<{
      permission: string;
      inheritedFrom: string;
      path: string[];
    }> = [];

    // Recursively collect inherited permissions
    if (role.inheritFrom) {
      await this.collectInheritedPermissions(roleId, role.inheritFrom, [], inheritedPermissions);
    }

    const allEffective = [...new Set([
      ...directPermissions,
      ...inheritedPermissions.map(item => item.permission)
    ])];

    return {
      direct: directPermissions,
      inherited: inheritedPermissions,
      effective: allEffective
    };
  }

  /**
   * Get role hierarchy tree
   * 
   * @returns Role hierarchy nodes
   */
  getRoleHierarchy(): RoleHierarchyNode[] {
    return Array.from(this.roleHierarchy.values()).filter(node => !node.parent);
  }

  /**
   * Check if user has specific role
   * 
   * @param userId - User ID
   * @param roleId - Role ID
   * @returns True if user has the role
   */
  userHasRole(userId: string, roleId: string): boolean {
    const userRoles = this.getUserRoles(userId);
    return userRoles.some(ur => ur.roleId === roleId);
  }

  /**
   * Check if user has any of the specified roles
   * 
   * @param userId - User ID
   * @param roleIds - Array of role IDs
   * @returns True if user has any of the roles
   */
  userHasAnyRole(userId: string, roleIds: string[]): boolean {
    const userRoles = this.getUserRoles(userId);
    const userRoleIds = userRoles.map(ur => ur.roleId);
    return roleIds.some(roleId => userRoleIds.includes(roleId));
  }

  /**
   * Get statistics about roles and assignments
   * 
   * @returns Role statistics
   */
  getStatistics(): {
    totalRoles: number;
    systemRoles: number;
    userRoles: number;
    totalAssignments: number;
    averageRolesPerUser: number;
  } {
    const allRoles = this.getAllRoles();
    const systemRoles = allRoles.filter(r => r.isSystem).length;
    const totalAssignments = Array.from(this.userRoles.values())
      .reduce((sum, roles) => sum + roles.filter(r => r.isActive).length, 0);
    const totalUsers = this.userRoles.size;

    return {
      totalRoles: allRoles.length,
      systemRoles,
      userRoles: allRoles.length - systemRoles,
      totalAssignments,
      averageRolesPerUser: totalUsers > 0 ? totalAssignments / totalUsers : 0
    };
  }

  /**
   * Initialize system roles
   */
  private initializeSystemRoles(): void {
    const systemRoles: Role[] = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system administration access',
        permissions: ['*:*'],
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'user',
        name: 'User',
        description: 'Basic user access',
        permissions: ['user:read', 'user:update-self'],
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'guest',
        name: 'Guest',
        description: 'Limited guest access',
        permissions: ['public:read'],
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const role of systemRoles) {
      this.roles.set(role.id, role);
    }

    this.rebuildHierarchy();
  }

  /**
   * Rebuild role hierarchy cache
   */
  private rebuildHierarchy(): void {
    this.roleHierarchy.clear();

    // Create hierarchy nodes
    for (const role of this.roles.values()) {
      const node: RoleHierarchyNode = {
        role,
        children: [],
        level: 0,
        effectivePermissions: [...role.permissions]
      };
      this.roleHierarchy.set(role.id, node);
    }

    // Build parent-child relationships
    for (const role of this.roles.values()) {
      if (role.inheritFrom) {
        const childNode = this.roleHierarchy.get(role.id)!;
        for (const parentId of role.inheritFrom) {
          const parentNode = this.roleHierarchy.get(parentId);
          if (parentNode) {
            parentNode.children.push(childNode);
            childNode.parent = parentNode;
          }
        }
      }
    }

    // Calculate levels and effective permissions
    this.calculateHierarchyLevels();
  }

  /**
   * Calculate hierarchy levels and effective permissions
   */
  private calculateHierarchyLevels(): void {
    const visited = new Set<string>();
    
    for (const node of this.roleHierarchy.values()) {
      if (!node.parent) {
        this.calculateNodeLevel(node, 0, visited, []);
      }
    }
  }

  /**
   * Calculate level for a hierarchy node
   * 
   * @param node - Node to calculate level for
   * @param level - Current level
   * @param visited - Visited nodes to detect cycles
   * @param path - Current path for cycle detection
   */
  private calculateNodeLevel(
    node: RoleHierarchyNode,
    level: number,
    visited: Set<string>,
    path: string[]
  ): void {
    if (level > this.maxDepth) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.MAX_DEPTH_EXCEEDED,
        `Role hierarchy depth exceeds maximum of ${this.maxDepth}`
      );
    }

    if (path.includes(node.role.id)) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.CIRCULAR_DEPENDENCY,
        `Circular dependency detected in role hierarchy: ${path.join(' -> ')} -> ${node.role.id}`
      );
    }

    node.level = Math.max(node.level, level);
    
    // Calculate effective permissions
    const effectivePermissions = new Set(node.role.permissions);
    if (node.parent) {
      for (const permission of node.parent.effectivePermissions) {
        effectivePermissions.add(permission);
      }
    }
    node.effectivePermissions = Array.from(effectivePermissions);

    visited.add(node.role.id);
    const newPath = [...path, node.role.id];

    for (const child of node.children) {
      this.calculateNodeLevel(child, level + 1, visited, newPath);
    }
  }

  /**
   * Check if adding inheritance would create circular dependency
   * 
   * @param roleId - Role that would inherit
   * @param parentIds - Parent role IDs
   * @returns True if circular dependency would be created
   */
  private wouldCreateCircularDependency(roleId: string, parentIds: string[]): boolean {
    const visited = new Set<string>();
    const stack = [...parentIds];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      
      if (currentId === roleId) {
        return true;
      }

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      const role = this.roles.get(currentId);
      if (role && role.inheritFrom) {
        stack.push(...role.inheritFrom);
      }
    }

    return false;
  }

  /**
   * Find roles that depend on the given role
   * 
   * @param roleId - Role ID to check dependencies for
   * @returns Array of dependent role IDs
   */
  private findDependentRoles(roleId: string): string[] {
    const dependentRoles: string[] = [];
    
    for (const role of this.roles.values()) {
      if (role.inheritFrom && role.inheritFrom.includes(roleId)) {
        dependentRoles.push(role.id);
      }
    }
    
    return dependentRoles;
  }

  /**
   * Recursively collect inherited permissions
   * 
   * @param roleId - Current role ID
   * @param parentIds - Parent role IDs
   * @param path - Current inheritance path
   * @param result - Result array to populate
   */
  private async collectInheritedPermissions(
    roleId: string,
    parentIds: string[],
    path: string[],
    result: Array<{ permission: string; inheritedFrom: string; path: string[] }>
  ): Promise<void> {
    if (path.length > this.maxDepth) {
      throw this.createAuthorizationError(
        AuthorizationErrorType.MAX_DEPTH_EXCEEDED,
        `Permission inheritance depth exceeds maximum of ${this.maxDepth}`
      );
    }

    for (const parentId of parentIds) {
      if (path.includes(parentId)) {
        throw this.createAuthorizationError(
          AuthorizationErrorType.CIRCULAR_DEPENDENCY,
          `Circular dependency in role inheritance: ${path.join(' -> ')} -> ${parentId}`
        );
      }

      const parentRole = this.roles.get(parentId);
      if (!parentRole) continue;

      const currentPath = [...path, parentId];

      // Add parent's direct permissions
      for (const permission of parentRole.permissions) {
        result.push({
          permission,
          inheritedFrom: parentId,
          path: currentPath
        });
      }

      // Recursively add parent's inherited permissions
      if (parentRole.inheritFrom) {
        await this.collectInheritedPermissions(parentId, parentRole.inheritFrom, currentPath, result);
      }
    }
  }

  /**
   * Clear hierarchy cache
   */
  private clearHierarchyCache(): void {
    this.hierarchyCache.clear();
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