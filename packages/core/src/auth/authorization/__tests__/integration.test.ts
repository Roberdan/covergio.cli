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
  AuthorizationConfig
} from '../types';

describe('Authorization Integration Tests', () => {
  let authService: AuthorizationService;
  let context: AuthorizationContext;

  beforeEach(() => {
    const config: AuthorizationConfig = {
      enableAttributeBasedAccess: true,
      enableRoleHierarchy: true,
      enablePolicyEngine: false,
      defaultDenyAll: false,
      auditEnabled: true
    };

    authService = new AuthorizationService(config);

    context = {
      user: {
        id: 'test-user',
        department: 'engineering',
        groups: ['developers']
      },
      action: 'read',
      environment: {
        ip: '192.168.1.1',
        time: new Date().toISOString()
      },
      session: {
        id: 'session-123',
        createdAt: new Date().toISOString(),
        mfaVerified: true
      }
    };
  });

  test('Complete RBAC workflow', async () => {
    // 1. Create permissions
    const permissions: Permission[] = [
      {
        id: 'users:read',
        name: 'Read Users',
        description: 'Can read user data',
        resource: 'users',
        action: 'read'
      },
      {
        id: 'users:write',
        name: 'Write Users',
        description: 'Can modify user data',
        resource: 'users',
        action: 'write'
      },
      {
        id: 'admin:all',
        name: 'Admin All',
        description: 'Full admin access',
        resource: '*',
        action: '*'
      }
    ];

    await authService.createPermissions(permissions);

    // 2. Create roles with hierarchy
    const roles: Role[] = [
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['users:read'],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'editor',
        name: 'Editor',
        description: 'Can read and write',
        permissions: ['users:write'],
        inheritFrom: ['viewer'], // Inherits read permissions
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'super-admin',
        name: 'Administrator',
        description: 'Full access',
        permissions: ['admin:all'],
        createdAt: '',
        updatedAt: ''
      }
    ];

    for (const role of roles) {
      await authService.createRole(role);
    }

    // 3. Assign roles to users
    await authService.assignRole('test-user', 'editor', 'system');
    await authService.assignRole('admin-user', 'super-admin', 'system');

    // 4. Test authorization scenarios
    
    // User should have read access (inherited from viewer role)
    const readResult = await authService.authorize('test-user', 'users', 'read', context);
    expect(readResult.granted).toBe(true);

    // User should have write access (direct from editor role)
    const writeResult = await authService.authorize('test-user', 'users', 'write', context);
    expect(writeResult.granted).toBe(true);

    // User should NOT have admin access
    const adminResult = await authService.authorize('test-user', 'system', 'delete', context);
    expect(adminResult.granted).toBe(false);

    // Admin user should have all access
    const adminContext = { ...context, user: { ...context.user, id: 'admin-user' } };
    const adminAllResult = await authService.authorize('admin-user', 'anything', 'delete', adminContext);
    expect(adminAllResult.granted).toBe(true);

    // 5. Verify role inheritance
    const userPermissions = await authService.getUserEffectivePermissions('test-user');
    expect(userPermissions.effective).toContain('users:read'); // Inherited
    expect(userPermissions.effective).toContain('users:write'); // Direct
    expect(userPermissions.direct).toContain('users:write');
    expect(userPermissions.inherited.length).toBeGreaterThan(0);

    // 6. Verify audit logging
    const logs = authService.getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some(log => log.action === 'read' && log.result === 'granted')).toBe(true);
    expect(logs.some(log => log.action === 'write' && log.result === 'granted')).toBe(true);
    expect(logs.some(log => log.action === 'delete' && log.result === 'denied')).toBe(true);

    // 7. Test bulk authorization
    const bulkResult = await authService.bulkAuthorize('test-user', {
      context,
      checks: [
        { resource: 'users', action: 'read' },
        { resource: 'users', action: 'write' },
        { resource: 'system', action: 'delete' }
      ]
    });

    expect(bulkResult.summary.total).toBe(3);
    expect(bulkResult.summary.granted).toBe(2);
    expect(bulkResult.summary.denied).toBe(1);

    // 8. Test permission matrix
    const matrix = authService.getPermissionMatrix();
    expect(matrix.roles.length).toBeGreaterThan(0);
    expect(matrix.permissions.length).toBe(3);
    expect(matrix.matrix.length).toEqual(matrix.roles.length);

    // 9. Test role effectiveness analysis
    const analysis = await authService.analyzeRoleEffectiveness('editor');
    expect(analysis.roleId).toBe('editor');
    expect(analysis.totalEffectivePermissions).toBeGreaterThan(1); // Should have inherited + direct

    // 10. Test statistics
    const stats = authService.getStatistics();
    expect(stats.roles.totalRoles).toBeGreaterThan(3); // Custom + system roles
    expect(stats.permissions.total).toBe(3);
  });

  test('Conditional permissions with ABAC', async () => {
    // Create permission with conditions
    const conditionalPermission: Permission = {
      id: 'users:read:department',
      name: 'Read Department Users',
      description: 'Can read users in same department',
      resource: 'users',
      action: 'read',
      conditions: [
        {
          attribute: 'department',
          operator: 'equals',
          value: 'engineering',
          context: 'user'
        }
      ]
    };

    await authService.createPermission(conditionalPermission);

    const role: Role = {
      id: 'dept-viewer',
      name: 'Department Viewer',
      description: 'Can view users in same department',
      permissions: ['users:read:department'],
      createdAt: '',
      updatedAt: ''
    };

    await authService.createRole(role);
    await authService.assignRole('test-user', 'dept-viewer', 'system');

    // Should be granted for engineering user
    const engineeringResult = await authService.authorize('test-user', 'users', 'read', context);
    expect(engineeringResult.granted).toBe(true);

    // Should be denied for different department
    const marketingContext = {
      ...context,
      user: { ...context.user, department: 'marketing' }
    };
    const marketingResult = await authService.authorize('test-user', 'users', 'read', marketingContext);
    expect(marketingResult.granted).toBe(false);
  });

  test('Dynamic role management', async () => {
    // Create a role
    const role: Role = {
      id: 'temp-role',
      name: 'Temporary Role',
      description: 'A temporary role for testing',
      permissions: ['users:read'],
      createdAt: '',
      updatedAt: ''
    };

    await authService.createRole(role);
    await authService.assignRole('test-user', 'temp-role', 'admin');

    // Verify role assignment
    expect(authService.getUserRoles('test-user').length).toBe(1);

    // Update role permissions
    await authService.updateRole('temp-role', {
      permissions: ['users:read', 'users:write']
    });

    const updatedRole = authService.getAllRoles().find(r => r.id === 'temp-role');
    expect(updatedRole?.permissions).toContain('users:write');

    // Remove role from user
    await authService.removeRole('test-user', 'temp-role');
    expect(authService.getUserRoles('test-user').filter(ur => ur.isActive).length).toBe(0);

    // Delete role
    await authService.deleteRole('temp-role');
    expect(authService.getAllRoles().find(r => r.id === 'temp-role' && !r.isSystem)).toBeUndefined();
  });

  test('Error handling and validation', async () => {
    // Test invalid context
    await expect(
      authService.authorize('', 'users', 'read', context)
    ).rejects.toThrow('User ID is required');

    await expect(
      authService.authorize('test-user', '', 'read', context)
    ).rejects.toThrow('Resource is required');

    await expect(
      authService.authorize('test-user', 'users', '', context)
    ).rejects.toThrow('Action is required');

    // Test creating duplicate role
    const role: Role = {
      id: 'test-role',
      name: 'Test Role',
      description: 'Test role',
      permissions: [],
      createdAt: '',
      updatedAt: ''
    };

    await authService.createRole(role);
    await expect(authService.createRole(role)).rejects.toThrow();

    // Test circular dependency
    const role1: Role = {
      id: 'role1',
      name: 'Role 1',
      description: 'Role 1',
      permissions: [],
      inheritFrom: ['role2'],
      createdAt: '',
      updatedAt: ''
    };

    const role2: Role = {
      id: 'role2',
      name: 'Role 2',
      description: 'Role 2',
      permissions: [],
      inheritFrom: ['role1'],
      createdAt: '',
      updatedAt: ''
    };

    await authService.createRole({ ...role1, inheritFrom: undefined });
    await authService.createRole({ ...role2, inheritFrom: undefined });

    // Try to create circular dependency
    await expect(
      authService.updateRole('role1', { inheritFrom: ['role2'] })
    ).resolves.toBeTruthy(); // Should work

    await expect(
      authService.updateRole('role2', { inheritFrom: ['role1'] })
    ).rejects.toThrow('circular dependency');
  });
});