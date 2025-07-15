/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthorizationService } from './AuthorizationService';
import { AuthorizationContext, AuthorizationError, AuthorizationErrorType } from './types';

/**
 * Request interface for authorization middleware
 */
export interface AuthorizationRequest {
  user?: {
    id: string;
    attributes?: Record<string, any>;
    groups?: string[];
    department?: string;
    location?: string;
  };
  session?: {
    id: string;
    createdAt: string;
    mfaVerified?: boolean;
    riskScore?: number;
  };
  ip?: string;
  userAgent?: string;
  path: string;
  method: string;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
}

/**
 * Response interface for authorization middleware
 */
export interface AuthorizationResponse {
  status(code: number): AuthorizationResponse;
  json(data: any): void;
  send(data: any): void;
}

/**
 * Next function for middleware chain
 */
export type NextFunction = (error?: Error) => void;

/**
 * Authorization middleware options
 */
export interface AuthorizationMiddlewareOptions {
  /** Resource extractor function */
  extractResource?: (req: AuthorizationRequest) => string;
  /** Action extractor function */
  extractAction?: (req: AuthorizationRequest) => string;
  /** Custom context builder */
  buildContext?: (req: AuthorizationRequest) => Partial<AuthorizationContext>;
  /** Skip authorization for certain paths */
  skipPaths?: string[];
  /** Skip authorization for certain methods */
  skipMethods?: string[];
  /** Custom error handler */
  onError?: (error: AuthorizationError, req: AuthorizationRequest, res: AuthorizationResponse) => void;
  /** Custom success handler */
  onSuccess?: (req: AuthorizationRequest, res: AuthorizationResponse) => void;
}

/**
 * Authorization middleware factory
 * 
 * Creates Express-style middleware for API endpoint authorization
 * 
 * @param authService - Authorization service instance
 * @param options - Middleware options
 * @returns Express middleware function
 */
export function createAuthorizationMiddleware(
  authService: AuthorizationService,
  options: AuthorizationMiddlewareOptions = {}
) {
  const {
    extractResource = defaultResourceExtractor,
    extractAction = defaultActionExtractor,
    buildContext = defaultContextBuilder,
    skipPaths = ['/health', '/metrics', '/auth/login'],
    skipMethods = ['OPTIONS'],
    onError = defaultErrorHandler,
    onSuccess
  } = options;

  return async (req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) => {
    try {
      // Skip authorization for certain paths and methods
      if (shouldSkipAuthorization(req, skipPaths, skipMethods)) {
        return next();
      }

      // Ensure user is authenticated
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      // Extract resource and action
      const resource = extractResource(req);
      const action = extractAction(req);

      // Build authorization context
      const context = buildAuthorizationContext(req, buildContext);

      // Perform authorization check
      const result = await authService.authorize(req.user.id, resource, action, context);

      if (!result.granted) {
        const error = new Error(result.reason || 'Access denied') as AuthorizationError;
        error.name = 'AuthorizationError';
        error.type = AuthorizationErrorType.PERMISSION_DENIED;
        error.context = context;
        error.resource = resource;
        error.action = action;
        error.details = {
          denyReasons: result.denyReasons,
          suggestions: result.suggestions
        };

        return onError(error, req, res);
      }

      // Authorization successful
      if (onSuccess) {
        onSuccess(req, res);
      }

      next();

    } catch (error) {
      const authError = error instanceof Error ? error as AuthorizationError : new Error(String(error)) as AuthorizationError;
      authError.name = 'AuthorizationError';
      authError.type = AuthorizationErrorType.PERMISSION_DENIED;
      
      onError(authError, req, res);
    }
  };
}

/**
 * Role-based authorization decorator for route handlers
 * 
 * @param requiredRoles - Array of required role IDs
 * @param authService - Authorization service instance
 * @returns Decorator function
 */
export function requireRoles(requiredRoles: string[], authService: AuthorizationService) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
      try {
        if (!req.user?.id) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
          });
        }

        const userRoles = authService.getUserRoles(req.user.id);
        const userRoleIds = userRoles.map(ur => ur.roleId);
        
        const hasRequiredRole = requiredRoles.some(roleId => userRoleIds.includes(roleId));
        
        if (!hasRequiredRole) {
          return res.status(403).json({
            error: 'Forbidden',
            message: `Required roles: ${requiredRoles.join(', ')}`,
            userRoles: userRoleIds
          });
        }

        return originalMethod.apply(this, [req, res, next]);
      } catch (error) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authorization check failed'
        });
      }
    };

    return descriptor;
  };
}

/**
 * Permission-based authorization decorator for route handlers
 * 
 * @param resource - Resource identifier
 * @param action - Required action
 * @param authService - Authorization service instance
 * @returns Decorator function
 */
export function requirePermission(resource: string, action: string, authService: AuthorizationService) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (req: AuthorizationRequest, res: AuthorizationResponse, next: NextFunction) {
      try {
        if (!req.user?.id) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
          });
        }

        const context = buildAuthorizationContext(req, defaultContextBuilder);
        const result = await authService.authorize(req.user.id, resource, action, context);

        if (!result.granted) {
          return res.status(403).json({
            error: 'Forbidden',
            message: result.reason,
            resource,
            action,
            suggestions: result.suggestions
          });
        }

        return originalMethod.apply(this, [req, res, next]);
      } catch (error) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authorization check failed'
        });
      }
    };

    return descriptor;
  };
}

/**
 * Default resource extractor
 * 
 * @param req - Request object
 * @returns Resource identifier
 */
function defaultResourceExtractor(req: AuthorizationRequest): string {
  // Extract resource from URL path
  const pathParts = req.path.split('/').filter(part => part.length > 0);
  
  if (pathParts.length === 0) {
    return 'root';
  }

  // Use the first path segment as resource type
  const resourceType = pathParts[0];

  // If there's an ID in the path, include it
  if (pathParts.length > 1 && pathParts[1] !== '') {
    return `${resourceType}:${pathParts[1]}`;
  }

  return resourceType;
}

/**
 * Default action extractor
 * 
 * @param req - Request object
 * @returns Action identifier
 */
function defaultActionExtractor(req: AuthorizationRequest): string {
  // Map HTTP methods to actions
  const methodToAction: Record<string, string> = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };

  return methodToAction[req.method.toUpperCase()] || 'read';
}

/**
 * Default context builder
 * 
 * @param req - Request object
 * @returns Partial authorization context
 */
function defaultContextBuilder(req: AuthorizationRequest): Partial<AuthorizationContext> {
  return {
    environment: {
      ip: req.ip,
      userAgent: req.userAgent,
      time: new Date().toISOString()
    }
  };
}

/**
 * Build complete authorization context
 * 
 * @param req - Request object
 * @param customBuilder - Custom context builder
 * @returns Complete authorization context
 */
function buildAuthorizationContext(
  req: AuthorizationRequest,
  customBuilder: (req: AuthorizationRequest) => Partial<AuthorizationContext>
): AuthorizationContext {
  const customContext = customBuilder(req);
  
  return {
    user: req.user!,
    action: defaultActionExtractor(req),
    session: req.session,
    environment: {
      ip: req.ip,
      userAgent: req.userAgent,
      time: new Date().toISOString(),
      ...customContext.environment
    },
    ...customContext
  };
}

/**
 * Check if authorization should be skipped
 * 
 * @param req - Request object
 * @param skipPaths - Paths to skip
 * @param skipMethods - Methods to skip
 * @returns True if authorization should be skipped
 */
function shouldSkipAuthorization(
  req: AuthorizationRequest,
  skipPaths: string[],
  skipMethods: string[]
): boolean {
  // Skip certain HTTP methods
  if (skipMethods.includes(req.method.toUpperCase())) {
    return true;
  }

  // Skip certain paths
  return skipPaths.some(path => {
    if (path.includes('*')) {
      const pattern = new RegExp(path.replace(/\*/g, '.*'));
      return pattern.test(req.path);
    }
    return req.path === path || req.path.startsWith(path);
  });
}

/**
 * Default error handler
 * 
 * @param error - Authorization error
 * @param req - Request object
 * @param res - Response object
 */
function defaultErrorHandler(
  error: AuthorizationError,
  req: AuthorizationRequest,
  res: AuthorizationResponse
): void {
  const statusCode = error.type === AuthorizationErrorType.PERMISSION_DENIED ? 403 : 500;
  
  res.status(statusCode).json({
    error: statusCode === 403 ? 'Forbidden' : 'Internal Server Error',
    message: error.message,
    type: error.type,
    resource: error.resource,
    action: error.action,
    details: error.details,
    timestamp: new Date().toISOString()
  });
}