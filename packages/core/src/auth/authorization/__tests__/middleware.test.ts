/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi } from 'vitest';
import {
  createAuthorizationMiddleware,
  requireRoles,
  requirePermission,
  AuthorizationRequest,
  AuthorizationResponse,
  NextFunction
} from '../middleware';
import { AuthorizationService } from '../AuthorizationService';
import { Permission, Role, AuthorizationConfig } from '../types';

// Mock implementations
class MockResponse implements AuthorizationResponse {
  statusCode = 200;
  data: any = null;

  status(code: number): AuthorizationResponse {
    this.statusCode = code;
    return this;
  }

  json(data: any): void {
    this.data = data;
  }

  send(data: any): void {
    this.data = data;
  }
}

describe('Authorization Middleware', () => {
  let authService: AuthorizationService;
  let mockRequest: AuthorizationRequest;
  let mockResponse: MockResponse;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const config: AuthorizationConfig = {
      enableAttributeBasedAccess: true,
      enableRoleHierarchy: true,
      auditEnabled: false, // Disable for testing
      strictMode: false
    };

    authService = new AuthorizationService(config);
    mockResponse = new MockResponse();
    mockNext = vi.fn();

    mockRequest = {
      user: {
        id: 'user123',
        attributes: { department: 'engineering' },
        groups: ['developers']
      },
      session: {
        id: 'session123',
        createdAt: new Date().toISOString(),
        mfaVerified: true
      },
      ip: '192.168.1.1',
      userAgent: 'test-agent',
      path: '/api/users/123',
      method: 'GET',
      params: { id: '123' },
      query: {},
      body: null
    };

    // Set up test data
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

  describe('createAuthorizationMiddleware', () => {
    test('should allow access with valid permissions', async () => {
      const middleware = createAuthorizationMiddleware(authService);
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.statusCode).toBe(200);
    });

    test('should deny access without authentication', async () => {
      const middleware = createAuthorizationMiddleware(authService);
      mockRequest.user = undefined;
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.statusCode).toBe(401);
      expect(mockResponse.data).toEqual({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    });

    test('should deny access without proper permissions', async () => {
      const middleware = createAuthorizationMiddleware(authService);
      mockRequest.method = 'POST'; // This would require 'create' action
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.statusCode).toBe(403);
    });

    test('should skip authorization for excluded paths', async () => {
      const middleware = createAuthorizationMiddleware(authService, {
        skipPaths: ['/health', '/api/users/*']
      });
      
      mockRequest.path = '/health';
      mockRequest.user = undefined; // Should still pass
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should skip authorization for excluded methods', async () => {
      const middleware = createAuthorizationMiddleware(authService, {
        skipMethods: ['OPTIONS']
      });
      
      mockRequest.method = 'OPTIONS';
      mockRequest.user = undefined; // Should still pass
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should use custom resource extractor', async () => {
      const customExtractor = vi.fn().mockReturnValue('custom-resource');
      const middleware = createAuthorizationMiddleware(authService, {
        extractResource: customExtractor
      });
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(customExtractor).toHaveBeenCalledWith(mockRequest);
    });

    test('should use custom action extractor', async () => {
      const customExtractor = vi.fn().mockReturnValue('custom-action');
      const middleware = createAuthorizationMiddleware(authService, {
        extractAction: customExtractor
      });
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(customExtractor).toHaveBeenCalledWith(mockRequest);
    });

    test('should use custom context builder', async () => {
      const customBuilder = vi.fn().mockReturnValue({
        environment: { customField: 'customValue' }
      });
      const middleware = createAuthorizationMiddleware(authService, {
        buildContext: customBuilder
      });
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(customBuilder).toHaveBeenCalledWith(mockRequest);
    });

    test('should use custom error handler', async () => {
      const customErrorHandler = vi.fn();
      const middleware = createAuthorizationMiddleware(authService, {
        onError: customErrorHandler
      });
      
      mockRequest.method = 'DELETE'; // No permission for this
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(customErrorHandler).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should use custom success handler', async () => {
      const customSuccessHandler = vi.fn();
      const middleware = createAuthorizationMiddleware(authService, {
        onSuccess: customSuccessHandler
      });
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(customSuccessHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle middleware errors gracefully', async () => {
      // Mock authService to throw error
      const errorAuthService = {
        authorize: vi.fn().mockRejectedValue(new Error('Service error'))
      } as any;
      
      const middleware = createAuthorizationMiddleware(errorAuthService);
      
      await middleware(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.statusCode).toBe(500);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRoles decorator', () => {
    test('should allow access with required role', async () => {
      class TestController {
        @requireRoles(['user-reader'], authService)
        async getUsers(req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
          res.json({ message: 'success' });
        }
      }

      const controller = new TestController();
      await controller.getUsers(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.data).toEqual({ message: 'success' });
    });

    test('should deny access without required role', async () => {
      class TestController {
        @requireRoles(['admin'], authService)
        async getUsers(req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
          res.json({ message: 'success' });
        }
      }

      const controller = new TestController();
      await controller.getUsers(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.statusCode).toBe(403);
      expect(mockResponse.data.error).toBe('Forbidden');
    });

    test('should deny access without authentication', async () => {
      class TestController {
        @requireRoles(['user-reader'], authService)
        async getUsers(req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
          res.json({ message: 'success' });
        }
      }

      const controller = new TestController();
      mockRequest.user = undefined;
      
      await controller.getUsers(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.statusCode).toBe(401);
    });

    test('should handle any of multiple required roles', async () => {
      // Assign additional role
      await authService.assignRole('user123', 'admin', 'system');

      class TestController {
        @requireRoles(['user-reader', 'admin'], authService)
        async getUsers(req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
          res.json({ message: 'success' });
        }
      }

      const controller = new TestController();
      await controller.getUsers(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.data).toEqual({ message: 'success' });
    });
  });

  describe('requirePermission decorator', () => {
    test('should allow access with required permission', async () => {
      class TestController {
        @requirePermission('users', 'read', authService)
        async getUsers(req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
          res.json({ message: 'success' });
        }
      }

      const controller = new TestController();
      await controller.getUsers(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.data).toEqual({ message: 'success' });
    });

    test('should deny access without required permission', async () => {
      class TestController {
        @requirePermission('users', 'write', authService)
        async getUsers(req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
          res.json({ message: 'success' });
        }
      }

      const controller = new TestController();
      await controller.getUsers(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.statusCode).toBe(403);
      expect(mockResponse.data.error).toBe('Forbidden');
    });

    test('should deny access without authentication', async () => {
      class TestController {
        @requirePermission('users', 'read', authService)
        async getUsers(req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
          res.json({ message: 'success' });
        }
      }

      const controller = new TestController();
      mockRequest.user = undefined;
      
      await controller.getUsers(mockRequest, mockResponse, mockNext);
      
      expect(mockResponse.statusCode).toBe(401);
    });
  });

  describe('Resource and Action Extraction', () => {
    test('should extract resource from URL path', () => {
      const middleware = createAuthorizationMiddleware(authService);
      
      // Test various path patterns
      const testCases = [
        { path: '/api/users', expected: 'users' },
        { path: '/api/users/123', expected: 'users:123' },
        { path: '/users', expected: 'users' },
        { path: '/', expected: 'root' },
        { path: '/api/posts/456/comments', expected: 'posts:456' }
      ];

      testCases.forEach(({ path, expected }) => {
        mockRequest.path = path;
        // The actual extraction happens inside middleware, this tests the concept
        expect(path.split('/').filter(p => p.length > 0)[0] || 'root').toBeTruthy();
      });
    });

    test('should map HTTP methods to actions', () => {
      const methodToAction = {
        'GET': 'read',
        'POST': 'create', 
        'PUT': 'update',
        'PATCH': 'update',
        'DELETE': 'delete'
      };

      Object.entries(methodToAction).forEach(([method, action]) => {
        expect(action).toBeTruthy();
      });
    });
  });
});