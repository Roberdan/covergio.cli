/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export all coordination components
export * from './ToolRegistry';
export * from './ContextManager';
export * from './CoordinationIntegration';

// Re-export types for convenience
export type {
  ToolPermissionLevel,
  ToolExecutionResult,
  ToolExecutionContext,
  ToolDefinition,
  ToolUsageStats,
  ToolConflict
} from './ToolRegistry';

export type {
  ContextItemType,
  ContextRelevance,
  ContextScope,
  ContextItem,
  ContextQuery,
  ContextSummary,
  ContextConflict,
  ContextSyncPoint
} from './ContextManager';