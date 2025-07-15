/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  OrchestratorError,
  ConfigurationError,
  InvalidConfigurationError,
  MissingConfigurationError,
  RoutingError,
  NoHandlerFoundError,
  HandlerNotAvailableError,
  WorkflowError,
  WorkflowValidationError,
  WorkflowExecutionError,
  WorkflowTimeoutError,
  AgentError,
  AgentNotFoundError,
  AgentOverloadError,
  NetworkError,
  ConnectionTimeoutError,
  ServiceUnavailableError,
  ValidationError,
  InvalidInputError,
  SchemaValidationError,
  ResourceError,
  ResourceExhaustionError,
  TimeoutError,
  SecurityError,
  AuthenticationError,
  AuthorizationError,
  SystemError,
  InternalError,
  ServiceStartupError,
  ErrorUtils,
} from './ErrorTypes.js';

describe('ErrorTypes', () => {
  describe('ConfigurationError', () => {
    it('should create configuration error with correct properties', () => {
      const error = new ConfigurationError('Test config error', { key: 'value' });
      
      expect(error.message).toBe('Test config error');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.category).toBe('configuration');
      expect(error.context).toEqual({ key: 'value' });
      expect(error.retryable).toBe(false);
      expect(error.severity).toBe('error');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create structured error format', () => {
      const error = new ConfigurationError('Test error');
      const structured = error.toStructured();
      
      expect(structured.name).toBe('ConfigurationError');
      expect(structured.message).toBe('Test error');
      expect(structured.code).toBe('CONFIG_ERROR');
      expect(structured.category).toBe('configuration');
      expect(structured.retryable).toBe(false);
      expect(structured.severity).toBe('error');
      expect(structured.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('InvalidConfigurationError', () => {
    it('should create invalid configuration error with details', () => {
      const error = new InvalidConfigurationError('maxRetries', 'number', 'string');
      
      expect(error.message).toBe('Invalid configuration for \'maxRetries\': expected number, got string');
      expect(error.code).toBe('INVALID_CONFIG');
      expect(error.category).toBe('configuration');
      expect(error.context).toEqual({
        configKey: 'maxRetries',
        expectedType: 'number',
        actualValue: 'string',
      });
    });
  });

  describe('MissingConfigurationError', () => {
    it('should create missing configuration error', () => {
      const error = new MissingConfigurationError('apiKey');
      
      expect(error.message).toBe('Missing required configuration: apiKey');
      expect(error.code).toBe('MISSING_CONFIG');
      expect(error.context).toEqual({ configKey: 'apiKey' });
    });
  });

  describe('RoutingError', () => {
    it('should create routing error with default retryable true', () => {
      const error = new RoutingError('Test routing error');
      
      expect(error.message).toBe('Test routing error');
      expect(error.code).toBe('ROUTING_ERROR');
      expect(error.category).toBe('routing');
      expect(error.retryable).toBe(true);
    });

    it('should allow setting retryable to false', () => {
      const error = new RoutingError('Test error', {}, false);
      
      expect(error.retryable).toBe(false);
    });
  });

  describe('NoHandlerFoundError', () => {
    it('should create no handler found error', () => {
      const error = new NoHandlerFoundError('test-request', ['handler1', 'handler2']);
      
      expect(error.message).toBe('No suitable handler found for request type: test-request');
      expect(error.code).toBe('NO_HANDLER_FOUND');
      expect(error.context).toEqual({
        requestType: 'test-request',
        availableHandlers: ['handler1', 'handler2'],
      });
      expect(error.retryable).toBe(false);
    });
  });

  describe('HandlerNotAvailableError', () => {
    it('should create handler not available error', () => {
      const error = new HandlerNotAvailableError('test-handler', 'overloaded');
      
      expect(error.message).toBe('Handler \'test-handler\' is not available: overloaded');
      expect(error.code).toBe('HANDLER_NOT_AVAILABLE');
      expect(error.context).toEqual({
        handlerId: 'test-handler',
        reason: 'overloaded',
      });
      expect(error.retryable).toBe(true);
    });
  });

  describe('WorkflowError', () => {
    it('should create workflow error with default retryable true', () => {
      const error = new WorkflowError('Test workflow error');
      
      expect(error.message).toBe('Test workflow error');
      expect(error.code).toBe('WORKFLOW_ERROR');
      expect(error.category).toBe('workflow');
      expect(error.retryable).toBe(true);
    });
  });

  describe('WorkflowValidationError', () => {
    it('should create workflow validation error', () => {
      const error = new WorkflowValidationError('workflow-1', ['missing step', 'invalid dependency']);
      
      expect(error.message).toBe('Workflow validation failed for \'workflow-1\': missing step, invalid dependency');
      expect(error.code).toBe('WORKFLOW_VALIDATION_ERROR');
      expect(error.context).toEqual({
        workflowId: 'workflow-1',
        validationErrors: ['missing step', 'invalid dependency'],
      });
      expect(error.retryable).toBe(false);
    });
  });

  describe('WorkflowExecutionError', () => {
    it('should create workflow execution error', () => {
      const originalError = new Error('Step failed');
      const error = new WorkflowExecutionError('workflow-1', 'step-1', originalError);
      
      expect(error.message).toBe('Workflow execution failed at step \'step-1\' in workflow \'workflow-1\': Step failed');
      expect(error.code).toBe('WORKFLOW_EXECUTION_ERROR');
      expect(error.context).toEqual({
        workflowId: 'workflow-1',
        stepId: 'step-1',
        originalError: 'Step failed',
      });
      expect(error.retryable).toBe(true);
    });
  });

  describe('WorkflowTimeoutError', () => {
    it('should create workflow timeout error', () => {
      const error = new WorkflowTimeoutError('workflow-1', 30000);
      
      expect(error.message).toBe('Workflow \'workflow-1\' timed out after 30000ms');
      expect(error.code).toBe('WORKFLOW_TIMEOUT');
      expect(error.context).toEqual({
        workflowId: 'workflow-1',
        timeoutMs: 30000,
      });
      expect(error.retryable).toBe(true);
    });
  });

  describe('AgentError', () => {
    it('should create agent error with default retryable true', () => {
      const error = new AgentError('Test agent error');
      
      expect(error.message).toBe('Test agent error');
      expect(error.code).toBe('AGENT_ERROR');
      expect(error.category).toBe('agent');
      expect(error.retryable).toBe(true);
    });
  });

  describe('AgentNotFoundError', () => {
    it('should create agent not found error', () => {
      const error = new AgentNotFoundError('agent-1', ['capability1', 'capability2']);
      
      expect(error.message).toBe('Agent \'agent-1\' not found or lacks required capabilities: capability1, capability2');
      expect(error.code).toBe('AGENT_NOT_FOUND');
      expect(error.context).toEqual({
        agentId: 'agent-1',
        requiredCapabilities: ['capability1', 'capability2'],
      });
      expect(error.retryable).toBe(false);
    });
  });

  describe('AgentOverloadError', () => {
    it('should create agent overload error', () => {
      const error = new AgentOverloadError('agent-1', 10, 5);
      
      expect(error.message).toBe('Agent \'agent-1\' is overloaded: 10/5');
      expect(error.code).toBe('AGENT_OVERLOAD');
      expect(error.context).toEqual({
        agentId: 'agent-1',
        currentLoad: 10,
        maxCapacity: 5,
      });
      expect(error.retryable).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('should create network error with default retryable true', () => {
      const error = new NetworkError('Test network error');
      
      expect(error.message).toBe('Test network error');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.category).toBe('network');
      expect(error.retryable).toBe(true);
    });
  });

  describe('ConnectionTimeoutError', () => {
    it('should create connection timeout error', () => {
      const error = new ConnectionTimeoutError('http://example.com', 5000);
      
      expect(error.message).toBe('Connection timeout to http://example.com after 5000ms');
      expect(error.code).toBe('CONNECTION_TIMEOUT');
      expect(error.context).toEqual({
        endpoint: 'http://example.com',
        timeoutMs: 5000,
      });
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error', () => {
      const error = new ServiceUnavailableError('api-service', 503);
      
      expect(error.message).toBe('Service \'api-service\' is unavailable (HTTP 503)');
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.context).toEqual({
        serviceName: 'api-service',
        statusCode: 503,
      });
    });

    it('should create service unavailable error without status code', () => {
      const error = new ServiceUnavailableError('api-service');
      
      expect(error.message).toBe('Service \'api-service\' is unavailable');
      expect(error.context).toEqual({
        serviceName: 'api-service',
        statusCode: undefined,
      });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with default non-retryable', () => {
      const error = new ValidationError('Test validation error');
      
      expect(error.message).toBe('Test validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.category).toBe('validation');
      expect(error.retryable).toBe(false);
    });
  });

  describe('InvalidInputError', () => {
    it('should create invalid input error', () => {
      const error = new InvalidInputError('email', 'email format', 'invalid-email');
      
      expect(error.message).toBe('Invalid input for \'email\': expected email format, got string');
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.context).toEqual({
        fieldName: 'email',
        expectedFormat: 'email format',
        actualValue: 'invalid-email',
      });
    });
  });

  describe('SchemaValidationError', () => {
    it('should create schema validation error', () => {
      const error = new SchemaValidationError('user-schema', ['missing field', 'invalid type']);
      
      expect(error.message).toBe('Schema validation failed for \'user-schema\': missing field, invalid type');
      expect(error.code).toBe('SCHEMA_VALIDATION_ERROR');
      expect(error.context).toEqual({
        schemaName: 'user-schema',
        validationErrors: ['missing field', 'invalid type'],
      });
    });
  });

  describe('ResourceError', () => {
    it('should create resource error with default retryable true', () => {
      const error = new ResourceError('Test resource error');
      
      expect(error.message).toBe('Test resource error');
      expect(error.code).toBe('RESOURCE_ERROR');
      expect(error.category).toBe('resource');
      expect(error.retryable).toBe(true);
    });
  });

  describe('ResourceExhaustionError', () => {
    it('should create resource exhaustion error', () => {
      const error = new ResourceExhaustionError('memory', 90, 100);
      
      expect(error.message).toBe('Resource exhaustion for memory: 90/100');
      expect(error.code).toBe('RESOURCE_EXHAUSTION');
      expect(error.context).toEqual({
        resourceType: 'memory',
        currentUsage: 90,
        maxCapacity: 100,
      });
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('database-query', 30000);
      
      expect(error.message).toBe('Operation \'database-query\' timed out after 30000ms');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.category).toBe('timeout');
      expect(error.context).toEqual({
        operation: 'database-query',
        timeoutMs: 30000,
      });
      expect(error.retryable).toBe(true);
    });
  });

  describe('SecurityError', () => {
    it('should create security error with critical severity', () => {
      const error = new SecurityError('Test security error');
      
      expect(error.message).toBe('Test security error');
      expect(error.code).toBe('SECURITY_ERROR');
      expect(error.category).toBe('security');
      expect(error.retryable).toBe(false);
      expect(error.severity).toBe('critical');
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('invalid credentials');
      
      expect(error.message).toBe('Authentication failed: invalid credentials');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.context).toEqual({ reason: 'invalid credentials' });
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error', () => {
      const error = new AuthorizationError('admin-panel', ['admin', 'write']);
      
      expect(error.message).toBe('Access denied to resource \'admin-panel\': requires admin, write');
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.context).toEqual({
        resource: 'admin-panel',
        requiredPermissions: ['admin', 'write'],
      });
    });
  });

  describe('SystemError', () => {
    it('should create system error with critical severity', () => {
      const error = new SystemError('Test system error');
      
      expect(error.message).toBe('Test system error');
      expect(error.code).toBe('SYSTEM_ERROR');
      expect(error.category).toBe('system');
      expect(error.retryable).toBe(true);
      expect(error.severity).toBe('critical');
    });
  });

  describe('InternalError', () => {
    it('should create internal error', () => {
      const originalError = new Error('Original error');
      const error = new InternalError('test-component', originalError);
      
      expect(error.message).toBe('Internal error in test-component: Original error');
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.context).toEqual({
        component: 'test-component',
        originalError: 'Original error',
      });
    });
  });

  describe('ServiceStartupError', () => {
    it('should create service startup error', () => {
      const error = new ServiceStartupError('api-service', 'port already in use');
      
      expect(error.message).toBe('Service \'api-service\' failed to start: port already in use');
      expect(error.code).toBe('SERVICE_STARTUP_ERROR');
      expect(error.context).toEqual({
        serviceName: 'api-service',
        reason: 'port already in use',
      });
    });
  });

  describe('ErrorUtils', () => {
    describe('isRetryable', () => {
      it('should return true for retryable OrchestratorError', () => {
        const error = new NetworkError('Network error');
        expect(ErrorUtils.isRetryable(error)).toBe(true);
      });

      it('should return false for non-retryable OrchestratorError', () => {
        const error = new ValidationError('Validation error');
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });

      it('should return true for network errors', () => {
        const error = new Error('network timeout');
        expect(ErrorUtils.isRetryable(error)).toBe(true);
      });

      it('should return false for validation errors', () => {
        const error = new Error('validation failed');
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });

      it('should return false for unknown errors', () => {
        const error = new Error('unknown error');
        expect(ErrorUtils.isRetryable(error)).toBe(false);
      });
    });

    describe('getSeverity', () => {
      it('should return severity for OrchestratorError', () => {
        const error = new SecurityError('Security error');
        expect(ErrorUtils.getSeverity(error)).toBe('critical');
      });

      it('should return default severity for unknown errors', () => {
        const error = new Error('unknown error');
        expect(ErrorUtils.getSeverity(error)).toBe('error');
      });
    });

    describe('getCategory', () => {
      it('should return category for OrchestratorError', () => {
        const error = new NetworkError('Network error');
        expect(ErrorUtils.getCategory(error)).toBe('network');
      });

      it('should categorize based on message for regular errors', () => {
        expect(ErrorUtils.getCategory(new Error('network timeout'))).toBe('network');
        expect(ErrorUtils.getCategory(new Error('connection failed'))).toBe('network');
        expect(ErrorUtils.getCategory(new Error('operation timed out'))).toBe('timeout');
        expect(ErrorUtils.getCategory(new Error('validation failed'))).toBe('validation');
        expect(ErrorUtils.getCategory(new Error('invalid input'))).toBe('validation');
        expect(ErrorUtils.getCategory(new Error('config error'))).toBe('configuration');
      });

      it('should return system category for unknown errors', () => {
        const error = new Error('unknown error');
        expect(ErrorUtils.getCategory(error)).toBe('system');
      });
    });

    describe('toStructured', () => {
      it('should convert OrchestratorError to structured format', () => {
        const error = new NetworkError('Network error', { endpoint: 'api.example.com' });
        const structured = ErrorUtils.toStructured(error);
        
        expect(structured.name).toBe('NetworkError');
        expect(structured.message).toBe('Network error');
        expect(structured.code).toBe('NETWORK_ERROR');
        expect(structured.category).toBe('network');
        expect(structured.context).toEqual({ endpoint: 'api.example.com' });
        expect(structured.retryable).toBe(true);
        expect(structured.severity).toBe('error');
      });

      it('should convert regular Error to structured format', () => {
        const error = new Error('Test error');
        const structured = ErrorUtils.toStructured(error);
        
        expect(structured.name).toBe('Error');
        expect(structured.message).toBe('Test error');
        expect(structured.code).toBe('UNKNOWN_ERROR');
        expect(structured.category).toBe('system');
        expect(structured.retryable).toBe(false);
        expect(structured.severity).toBe('error');
      });

      it('should convert non-Error objects to structured format', () => {
        const structured = ErrorUtils.toStructured('string error');
        
        expect(structured.name).toBe('UnknownError');
        expect(structured.message).toBe('string error');
        expect(structured.code).toBe('UNKNOWN_ERROR');
        expect(structured.category).toBe('system');
        expect(structured.retryable).toBe(false);
        expect(structured.severity).toBe('error');
      });
    });

    describe('createError', () => {
      it('should create appropriate error types based on code', () => {
        const configError = ErrorUtils.createError('CONFIG_ERROR', 'Test config error');
        expect(configError).toBeInstanceOf(ConfigurationError);
        expect(configError.message).toBe('Test config error');

        const routingError = ErrorUtils.createError('ROUTING_ERROR', 'Test routing error');
        expect(routingError).toBeInstanceOf(RoutingError);
        expect(routingError.message).toBe('Test routing error');

        const workflowError = ErrorUtils.createError('WORKFLOW_ERROR', 'Test workflow error');
        expect(workflowError).toBeInstanceOf(WorkflowError);
        expect(workflowError.message).toBe('Test workflow error');
      });

      it('should create InternalError for unknown codes', () => {
        const error = ErrorUtils.createError('UNKNOWN_CODE', 'Test error');
        expect(error).toBeInstanceOf(InternalError);
        expect(error.message).toBe('Internal error in ErrorUtils: Test error');
      });
    });
  });
});