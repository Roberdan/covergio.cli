# Agent Lifecycle Manager

## Overview
The `AgentLifecycleManager` is a core component responsible for managing the lifecycle of agents in the Convergio platform. It handles agent registration, state management, error handling, and resource management.

## Key Features

### 1. Lifecycle Management
- Manages agent states: `initializing`, `ready`, `running`, `paused`, `error`, `terminating`, `terminated`
- Handles state transitions with validation
- Provides methods for pausing, resuming, and terminating agents

### 2. Error Handling
- Comprehensive error categorization (recoverable vs. non-recoverable)
- Automatic recovery for transient errors
- Circuit breaker pattern to prevent cascading failures
- Detailed error logging with correlation IDs

### 3. Resource Management
- Tracks resource usage (CPU, memory, network)
- Enforces resource limits
- Handles resource cleanup

### 4. Health Monitoring
- Tracks agent health status
- Calculates error rates and performance metrics
- Emits health events

## Usage

### Initialization

```typescript
import { AgentLifecycleManager } from '@convergio/core/universal/agents/AgentLifecycleManager';

// Initialize with optional resource limits
const lifecycleManager = new AgentLifecycleManager({
  maxMemoryMB: 1024,
  maxExecutionTimeMs: 30000,
  maxConcurrentRequests: 10,
  rateLimitPerMinute: 100
});
```

### Registering an Agent

```typescript
await lifecycleManager.registerAgent(agent);
```

### Handling Agent Errors

```typescript
// Listen for agent errors
lifecycleManager.on('agent-error', ({ agentId, error, timestamp, errorId, correlationId }) => {
  console.error(`Agent ${agentId} error:`, error);
  // Handle error...
});
```

## Error Recovery

The AgentLifecycleManager implements several recovery strategies:

1. **Automatic Retry**: For transient errors
2. **Circuit Breaking**: Prevents cascading failures
3. **Graceful Degradation**: Falls back to reduced functionality
4. **Emergency Shutdown**: For critical failures

## Events

| Event | Description | Payload |
|-------|-------------|---------|
| `agent-registered` | When a new agent is registered | `{ agentId: string, agent: IAgent }` |
| `agent-unregistered` | When an agent is unregistered | `{ agentId: string }` |
| `agent-state-changed` | When an agent's state changes | `{ agentId: string, from: AgentState, to: AgentState, reason?: string }` |
| `agent-error` | When an error occurs | `{ agentId: string, error: Error, timestamp: Date, errorId: string, correlationId: string }` |
| `agent-recovery-attempt` | When recovery is attempted | `{ agentId: string, errorId: string, correlationId: string, timestamp: Date, success: boolean }` |
| `agent-critical-error` | For unrecoverable errors | `{ agentId: string, error: Error, errorId: string, correlationId: string, timestamp: Date }` |

## Best Practices

1. Always handle agent errors using the provided events
2. Monitor resource usage to prevent memory leaks
3. Use correlation IDs for tracing requests across services
4. Implement proper cleanup in the `terminate` method
5. Test error scenarios thoroughly
