# AutoGen Integration

This module provides integration with Microsoft's AutoGen framework for multi-agent conversations and collaboration patterns.

## Overview

The AutoGen integration consists of several key components:

- **Python Bridge**: A Python server that wraps AutoGen functionality
- **TypeScript Client**: TypeScript classes that connect to the Python bridge
- **Agent Wrapper**: TypeScript wrapper for AutoGen agents
- **Collaboration Patterns**: Implementations of various multi-agent collaboration strategies

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TypeScript    │    │   Python        │    │   AutoGen       │
│   Client        │◄──►│   Bridge        │◄──►│   Framework     │
│                 │    │                 │    │                 │
│ AutoGenIntegration   │ autogen_bridge.py │    │ ConversableAgent│
│ PythonAutoGenBridge  │ WebSocket+HTTP   │    │ GroupChat       │
│ AutoGenAgent    │    │ FastAPI         │    │ GroupChatManager│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Install Python Dependencies

```bash
cd src/autogen/python
pip install -r requirements.txt
```

### 2. Start the Python Bridge

```bash
python start_bridge.py
```

The bridge will start on:
- WebSocket: `ws://localhost:8765`
- HTTP API: `http://localhost:8766`

### 3. Use in TypeScript

```typescript
import { AutoGenIntegration, CollaborationPattern } from './autogen';

// Initialize the integration
const autoGen = new AutoGenIntegration({
  defaultLLM: 'gpt-4',
  enableLogging: true
});

await autoGen.initialize();

// Create agents from Universal Agent definitions
const analystId = await autoGen.createAgentFromDefinition({
  role: 'data-analyst',
  description: 'Analyzes data and provides insights',
  capabilities: [/* ... */],
  personality: {
    traits: ['analytical', 'thorough'],
    communicationStyle: 'professional',
    expertise: ['statistics'],
    approach: 'methodical'
  }
});

const researcherId = await autoGen.createAgentFromDefinition({
  role: 'researcher',
  description: 'Conducts research and gathers information',
  capabilities: [/* ... */],
  personality: {
    traits: ['curious', 'detail-oriented'],
    communicationStyle: 'inquisitive',
    expertise: ['research methodology'],
    approach: 'systematic'
  }
});

// Start a conversation
const conversation = await autoGen.startConversation(
  analystId,
  researcherId,
  'Can you help me analyze the quarterly sales data?',
  { maxTurns: 10 }
);

// Use collaboration patterns
const brainstormResults = await autoGen.executeCollaborationPattern(
  CollaborationPattern.BRAINSTORM,
  [analystId, researcherId, 'creative-thinker'],
  'How can we improve our product development process?'
);
```

## Configuration

### Environment Variables

```bash
# Python Bridge Configuration
AUTOGEN_BRIDGE_HOST=localhost
AUTOGEN_BRIDGE_PORT=8765
AUTOGEN_HTTP_PORT=8766

# API Keys (at least one required)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
```

### AutoGen Configuration

```typescript
const config: AutoGenConfig = {
  defaultLLM: 'gpt-4',
  defaultTimeout: 30000,
  enableLogging: true,
  logLevel: 'info',
  cacheEnabled: true,
  maxCacheSize: 1000,
  workingDirectory: './autogen_workspace',
  enableCodeExecution: true,
  dockerEnabled: false
};

const autoGen = new AutoGenIntegration(config);
```

## Features

### Agent Creation

Create agents from Universal Agent definitions or custom AutoGen configurations:

```typescript
// From Universal Agent definition
const agentId = await autoGen.createAgentFromDefinition(universalAgentDef);

// Custom AutoGen configuration
const customAgent = await autoGen.createAgent({
  name: 'custom-agent',
  role: 'specialist',
  system_message: 'You are a domain specialist...',
  llm_config: {
    model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 2000
  },
  tools: [/* custom tools */]
});
```

### Collaboration Patterns

#### Sequential Pattern
Agents work in sequence, each building on the previous agent's output:

```typescript
const result = await autoGen.executeCollaborationPattern(
  CollaborationPattern.SEQUENTIAL,
  ['researcher', 'analyst', 'writer'],
  'Create a comprehensive market analysis report'
);
```

#### Parallel Pattern
Multiple agents work on the same problem simultaneously:

```typescript
const result = await autoGen.executeCollaborationPattern(
  CollaborationPattern.PARALLEL,
  ['analyst1', 'analyst2', 'analyst3'],
  'Analyze this dataset from different perspectives'
);
```

#### Debate Pattern
Agents engage in structured debate to explore different viewpoints:

```typescript
const result = await autoGen.executeCollaborationPattern(
  CollaborationPattern.DEBATE,
  ['optimist', 'pessimist', 'realist'],
  'Should we invest in this new technology?'
);
```

#### Consultation Pattern
One expert agent provides consultation to multiple client agents:

```typescript
const result = await autoGen.executeCollaborationPattern(
  CollaborationPattern.CONSULTATION,
  ['legal-expert', 'client1', 'client2'],
  'Review these contract terms for potential issues'
);
```

#### Brainstorm Pattern
Agents collaborate creatively to generate ideas:

```typescript
const result = await autoGen.executeCollaborationPattern(
  CollaborationPattern.BRAINSTORM,
  ['creative', 'practical', 'technical'],
  'Generate innovative solutions for remote team collaboration'
);
```

### Group Chats

Create and manage group conversations:

```typescript
const chatId = await autoGen.createGroupChat(
  ['agent1', 'agent2', 'agent3'],
  {
    max_round: 15,
    speaker_selection_method: 'auto',
    allow_repeat_speaker: true
  }
);
```

### Conversation Statistics

Track and analyze conversation performance:

```typescript
// Get stats for all conversations
const allStats = autoGen.getConversationStats();

// Get stats for specific conversation
const specificStats = autoGen.getConversationStats('conversation-id');

console.log(specificStats.totalMessages);
console.log(specificStats.messagesByAgent);
console.log(specificStats.tokenUsage);
console.log(specificStats.conversationDuration);
```

## Error Handling

The integration provides comprehensive error handling:

```typescript
try {
  await autoGen.createAgent(config);
} catch (error) {
  if (error instanceof AgentCreationError) {
    console.error('Agent creation failed:', error.message);
    console.error('Context:', error.context);
  } else if (error instanceof BridgeError) {
    console.error('Bridge connection failed:', error.message);
  }
}
```

## Event System

Listen to various events for monitoring and debugging:

```typescript
autoGen.on('agent.created', (event) => {
  console.log(`Agent created: ${event.agent.name}`);
});

autoGen.on('agent.messageGenerated', (event) => {
  console.log(`Message from ${event.agent.name}: ${event.message.content}`);
});

autoGen.on('groupChat.started', (event) => {
  console.log(`Group chat started with ${event.groupChat.agents.length} agents`);
});

autoGen.on('error.occurred', (event) => {
  console.error(`Error in ${event.context}: ${event.error.message}`);
});
```

## Bridge Management

Monitor and manage the Python bridge connection:

```typescript
// Check bridge status
const status = autoGen.getBridgeStatus();
console.log('Connected:', status.connected);
console.log('WebSocket URL:', status.websocketUrl);
console.log('HTTP URL:', status.httpUrl);

// Handle connection events
autoGen.on('bridgeConnected', () => {
  console.log('Bridge connected successfully');
});

autoGen.on('bridgeDisconnected', (data) => {
  console.log('Bridge disconnected:', data.reason);
});
```

## Testing

Run the test suite:

```bash
npm test src/autogen/
```

The tests include:
- AutoGen integration functionality
- Python bridge communication
- Agent creation and management
- Conversation handling
- Error scenarios
- Event system

## Troubleshooting

### Common Issues

1. **Bridge Connection Failed**
   - Ensure Python dependencies are installed
   - Check that the bridge server is running
   - Verify firewall settings allow connections to ports 8765/8766

2. **Agent Creation Errors**
   - Verify API keys are configured correctly
   - Check that the LLM model is supported
   - Ensure agent configuration is valid

3. **Conversation Timeouts**
   - Increase timeout values in configuration
   - Check network connectivity
   - Monitor Python bridge logs for errors

### Debug Mode

Enable detailed logging:

```typescript
const autoGen = new AutoGenIntegration({
  enableLogging: true,
  logLevel: 'debug'
});
```

### Bridge Logs

Monitor Python bridge logs:

```bash
python start_bridge.py --log-level debug
```

## Performance Considerations

- **Connection Pooling**: The bridge maintains persistent connections
- **Message Batching**: WebSocket messages are batched for efficiency
- **Caching**: Agent configurations and responses are cached
- **Resource Management**: Automatic cleanup of completed conversations

## Security Notes

- **API Keys**: Store API keys securely, never commit to version control
- **Network Security**: Consider using HTTPS/WSS in production
- **Access Control**: Implement authentication for the bridge API
- **Input Validation**: All inputs are validated before processing

## Integration with Universal Orchestrator

The AutoGen integration seamlessly works with the Universal Orchestrator:

```typescript
import { UniversalOrchestrator } from '../orchestrator';
import { AutoGenIntegration } from '../autogen';

const orchestrator = new UniversalOrchestrator(config);
const autoGen = new AutoGenIntegration();

// Register AutoGen as a handler
orchestrator.registerHandler('multi-agent-conversation', async (request) => {
  const agents = await createAgentsFromRequest(request);
  return await autoGen.executeCollaborationPattern(
    CollaborationPattern.SEQUENTIAL,
    agents,
    request.query
  );
});
```

This integration enables sophisticated multi-agent workflows within the broader orchestrator framework.