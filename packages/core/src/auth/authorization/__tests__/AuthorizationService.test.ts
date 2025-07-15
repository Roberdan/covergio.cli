/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthorizationService } from '../AuthorizationService';
import { PermissionEngine } from '../PermissionEngine';
import { RoleManager } from '../RoleManager';
import {
  Permission,
  Role,
  AuthorizationContext,
  AuthorizationConfig,
  AuthorizationErrorType
} from '../types';

describe('AuthorizationService', () => {
  let authService: AuthorizationService;
  let permissionEngine: PermissionEngine;
  let roleManager: RoleManager;
  let mockContext: AuthorizationContext;

  beforeEach(() => {
    const config: AuthorizationConfig = {
      enableAttributeBasedAccess: true,
      enableRoleHierarchy: true,
      enablePolicyEngine: false, // Disable policy engine for simpler testing
      defaultDenyAll: false, // Disable default deny for testing
      cachePermissions: true,
      auditEnabled: true,
      strictMode: false // Disable for testing
    };

    permissionEngine = new PermissionEngine();
    roleManager = new RoleManager();
    authService = new AuthorizationService(config, permissionEngine, roleManager);

    mockContext = {
      user: {
        id: 'user123',
        attributes: { department: 'engineering' },
        groups: ['developers'],
        department: 'engineering'
      },
      action: 'read',
      environment: {
        ip: '192.168.1.1',
        userAgent: 'test-agent',
        time: new Date().toISOString()
      },
      session: {
        id: 'session123',
        createdAt: new Date().toISOString(),
        mfaVerified: true
      }
    };
  });

  describe('Permission Management', () => {
    test('should create and register permission', async () => {
      const permission: Permission = {
        id: 'perm1',
        name: 'Read Users',
        description: 'Permission to read user data',
        resource: 'users',
        action: 'read'
      };

      const created = await authService.createPermission(permission);
      expect(created).toEqual(permission);

      const retrieved = authService.getAllPermissions();
      expect(retrieved).toContainEqual(permission);
    });

    test('should create multiple permissions', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          name: 'Read Users',
          description: 'Permission to read user data',
          resource: 'users',
          action: 'read'
        },
        {
          id: 'perm2',
          name: 'Write Users',
          description: 'Permission to write user data',
          resource: 'users',
          action: 'write'
        }
      ];

      const created = await authService.createPermissions(permissions);
      expect(created).toEqual(permissions);

      const retrieved = authService.getAllPermissions();
      expect(retrieved).toHaveLength(permissions.length);
    });

    test('should delete permission', async () => {
      const permission: Permission = {
        id: 'perm1',
        name: 'Read Users',
        description: 'Permission to read user data',
        resource: 'users',
        action: 'read'
      };

      await authService.createPermission(permission);
      await authService.deletePermission(permission.id);

      const retrieved = authService.getAllPermissions();
      expect(retrieved).not.toContainEqual(permission);
    });
  });

  describe('Role Management', () => {
    test('should create role', async () => {
      const role: Role = {
        id: 'role1',
        name: 'User Role',
        description: 'Basic user role',
        permissions: ['perm1'],
        createdAt: '',
        updatedAt: ''
      };

      const created = await authService.createRole(role);
      expect(created.id).toBe(role.id);
      expect(created.name).toBe(role.name);
      expect(created.createdAt).toBeTruthy();
      expect(created.updatedAt).toBeTruthy();
    });

    test('should update role', async () => {
      const role: Role = {
        id: 'role1',
        name: 'User Role',
        description: 'Basic user role',
        permissions: ['perm1'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createRole(role);
      
      const updated = await authService.updateRole(role.id, {
        name: 'Updated User Role',
        permissions: ['perm1', 'perm2']
      });

      expect(updated.name).toBe('Updated User Role');
      expect(updated.permissions).toEqual(['perm1', 'perm2']);
    });

    test('should delete role', async () => {
      const role: Role = {
        id: 'role1',
        name: 'User Role',
        description: 'Basic user role',
        permissions: ['perm1'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createRole(role);
      await authService.deleteRole(role.id);

      const roles = authService.getAllRoles();
      expect(roles.find(r => r.id === role.id && !r.isSystem)).toBeUndefined();
    });

    test('should assign role to user', async () => {
      const role: Role = {
        id: 'role1',
        name: 'User Role',
        description: 'Basic user role',
        permissions: ['perm1'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createRole(role);
      
      const userRole = await authService.assignRole('user123', 'role1', 'admin');
      expect(userRole.userId).toBe('user123');
      expect(userRole.roleId).toBe('role1');
      expect(userRole.assignedBy).toBe('admin');
      expect(userRole.isActive).toBe(true);
    });

    test('should remove role from user', async () => {
      const role: Role = {
        id: 'role1',
        name: 'User Role',
        description: 'Basic user role',
        permissions: ['perm1'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createRole(role);
      await authService.assignRole('user123', 'role1', 'admin');
      await authService.removeRole('user123', 'role1');

      const userRoles = authService.getUserRoles('user123');
      expect(userRoles.filter(ur => ur.isActive)).toHaveLength(0);
    });
  });

  describe('Authorization', () => {
    beforeEach(async () => {
      // Set up test permissions and roles
      const permission: Permission = {
        id: 'users:read',
        name: 'Read Users',
        description: 'Permission to read user data',
        resource: 'users',
        action: 'read'
      };

      const role: Role = {
        id: 'user-reader',
        name: 'User Reader',
        description: 'Can read user data',
        permissions: ['users:read'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createPermission(permission);
      await authService.createRole(role);
      await authService.assignRole('user123', 'user-reader', 'admin');
    });

    test('should grant access with valid permission', async () => {
      const result = await authService.authorize('user123', 'users', 'read', mockContext);
      
      expect(result.granted).toBe(true);
      expect(result.matchedPermissions).toContain('users:read');
    });

    test('should deny access without permission', async () => {
      const result = await authService.authorize('user123', 'users', 'write', mockContext);
      
      expect(result.granted).toBe(false);
      expect(result.denyReasons).toBeTruthy();
    });

    test('should deny access for unknown user', async () => {
      const result = await authService.authorize('unknown', 'users', 'read', mockContext);
      
      expect(result.granted).toBe(false);
    });

    test('should validate authorization request', async () => {
      await expect(
        authService.authorize('', 'users', 'read', mockContext)
      ).rejects.toThrow('User ID is required');

      await expect(
        authService.authorize('user123', '', 'read', mockContext)
      ).rejects.toThrow('Resource is required');

      await expect(
        authService.authorize('user123', 'users', '', mockContext)
      ).rejects.toThrow('Action is required');
    });
  });

  describe('Bulk Authorization', () => {
    beforeEach(async () => {
      const permissions: Permission[] = [
        {
          id: 'users:read',
          name: 'Read Users',
          description: 'Permission to read user data',
          resource: 'users',
          action: 'read'
        },
        {
          id: 'posts:read',
          name: 'Read Posts',
          description: 'Permission to read posts',
          resource: 'posts',
          action: 'read'
        }
      ];

      const role: Role = {
        id: 'reader',
        name: 'Reader',
        description: 'Can read data',
        permissions: ['users:read', 'posts:read'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createPermissions(permissions);
      await authService.createRole(role);
      await authService.assignRole('user123', 'reader', 'admin');
    });

    test('should perform bulk authorization', async () => {
      const request = {
        context: mockContext,
        checks: [
          { resource: 'users', action: 'read' },
          { resource: 'posts', action: 'read' },
          { resource: 'admin', action: 'write' }
        ]
      };

      const result = await authService.bulkAuthorize('user123', request);
      
      expect(result.summary.total).toBe(3);
      expect(result.summary.granted).toBe(2);
      expect(result.summary.denied).toBe(1);

      expect(result.results[0].granted).toBe(true); // users:read
      expect(result.results[1].granted).toBe(true); // posts:read
      expect(result.results[2].granted).toBe(false); // admin:write
    });
  });

  describe('Policy Engine', () => {
    test('should create authorization policy', async () => {
      const policy = {
        id: 'deny-external-access',
        name: 'Deny External Access',
        description: 'Deny access from external IPs',
        effect: 'deny' as const,
        resources: ['sensitive-data'],
        actions: ['*'],
        conditions: [],
        priority: 100,
        isActive: true,
        createdAt: '',
        updatedAt: ''
      };

      const created = await authService.createPolicy(policy);
      expect(created.id).toBe(policy.id);
      expect(created.name).toBe(policy.name);
    });
  });

  describe('Permission Matrix', () => {
    beforeEach(async () => {
      const permissions: Permission[] = [
        {
          id: 'users:read',
          name: 'Read Users',
          description: 'Permission to read user data',
          resource: 'users',
          action: 'read'
        },
        {
          id: 'users:write',
          name: 'Write Users',
          description: 'Permission to write user data',
          resource: 'users',
          action: 'write'
        }
      ];

      const roles: Role[] = [
        {
          id: 'reader',
          name: 'Reader',
          description: 'Can read data',
          permissions: ['users:read'],
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'writer',
          name: 'Writer',
          description: 'Can write data',
          permissions: ['users:read', 'users:write'],
          createdAt: '',
          updatedAt: ''
        }
      ];

      await authService.createPermissions(permissions);
      for (const role of roles) {
        await authService.createRole(role);
      }
    });

    test('should generate permission matrix', () => {
      const matrix = authService.getPermissionMatrix();
      
      expect(matrix.roles).toHaveLength(5); // 2 custom + 3 system roles
      expect(matrix.permissions).toHaveLength(2);
      expect(matrix.matrix).toHaveLength(5);
      expect(matrix.matrix[0]).toHaveLength(2);
    });
  });

  describe('Role Effectiveness Analysis', () => {
    test('should analyze role effectiveness', async () => {
      const permission: Permission = {
        id: 'users:read',
        name: 'Read Users',
        description: 'Permission to read user data',
        resource: 'users',
        action: 'read'
      };

      const role: Role = {
        id: 'user-reader',
        name: 'User Reader',
        description: 'Can read user data',
        permissions: ['users:read'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createPermission(permission);
      await authService.createRole(role);

      const analysis = await authService.analyzeRoleEffectiveness('user-reader');
      
      expect(analysis.roleId).toBe('user-reader');
      expect(analysis.roleName).toBe('User Reader');
      expect(analysis.directPermissions).toBe(1);
      expect(analysis.inheritedPermissions).toBe(0);
      expect(analysis.totalEffectivePermissions).toBe(1);
      expect(analysis.recommendations).toHaveLength(3);
    });
  });

  describe('Audit Logging', () => {
    beforeEach(async () => {
      const permission: Permission = {
        id: 'users:read',
        name: 'Read Users',
        description: 'Permission to read user data',
        resource: 'users',
        action: 'read'
      };

      const role: Role = {
        id: 'user-reader',
        name: 'User Reader',
        description: 'Can read user data',
        permissions: ['users:read'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createPermission(permission);
      await authService.createRole(role);
      await authService.assignRole('user123', 'user-reader', 'admin');
    });

    test('should log authorization events', async () => {
      // Clear any existing logs first
      authService.clearAuditLogs();
      
      await authService.authorize('user123', 'users', 'read', mockContext);
      
      const logs = authService.getAuditLogs();
      const authLogs = logs.filter(log => log.action === 'read');
      
      expect(authLogs).toHaveLength(1);
      expect(authLogs[0].userId).toBe('user123');
      expect(authLogs[0].resource).toBe('users');
      expect(authLogs[0].result).toBe('granted');
    });

    test('should filter audit logs', async () => {
      // Clear any existing logs first
      authService.clearAuditLogs();
      
      await authService.authorize('user123', 'users', 'read', mockContext);
      await authService.authorize('user123', 'users', 'write', mockContext);
      
      const grantedLogs = authService.getAuditLogs({ result: 'granted' });
      const deniedLogs = authService.getAuditLogs({ result: 'denied' });
      
      expect(grantedLogs).toHaveLength(1);
      expect(deniedLogs).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    test('should provide service statistics', async () => {
      const permission: Permission = {
        id: 'users:read',
        name: 'Read Users',
        description: 'Permission to read user data',
        resource: 'users',
        action: 'read'
      };

      const role: Role = {
        id: 'user-reader',
        name: 'User Reader',
        description: 'Can read user data',
        permissions: ['users:read'],
        createdAt: '',
        updatedAt: ''
      };

      await authService.createPermission(permission);
      await authService.createRole(role);
      await authService.assignRole('user123', 'user-reader', 'admin');

      const stats = authService.getStatistics();
      
      expect(stats.roles.totalRoles).toBe(4); // 1 custom + 3 system
      expect(stats.roles.systemRoles).toBe(3);
      expect(stats.roles.userRoles).toBe(1);
      expect(stats.permissions.total).toBe(1);
      expect(stats.policies.total).toBe(0); // No policies when policy engine is disabled
    });
  });

  describe('Cache Management', () => {
    test('should clear caches', () => {
      expect(() => authService.clearCaches()).not.toThrow();
    });
  });
});