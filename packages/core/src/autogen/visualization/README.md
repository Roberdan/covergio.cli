# Conversation Visualization and History Tracking

This module provides comprehensive visualization and history tracking capabilities for multi-agent conversations in the AutoGen integration system.

## Overview

The visualization system consists of three main components:

1. **ConversationHistory** - Tracks and manages conversation sessions, turns, and threads
2. **ConversationVisualizer** - Creates various visual representations of conversation data
3. **VisualizationIntegration** - Integrates visualization capabilities with the conversation system

## Components

### ConversationHistory

Manages conversation data with the following features:

- **Session Management**: Create, track, and complete conversation sessions
- **Turn Tracking**: Record individual conversation turns with metadata
- **Thread Detection**: Automatically identify conversation threads and topics
- **Flow Analysis**: Track participation metrics and conversation phases
- **Statistics Generation**: Provide detailed conversation analytics
- **Data Export**: Export conversation data in multiple formats
- **Archival System**: Automatically archive old conversations

### ConversationVisualizer

Creates visual representations of conversation data:

- **Timeline Visualization**: Shows conversation progression over time
- **Flow Visualization**: Displays conversation phases and transitions
- **Network Visualization**: Maps agent interactions and relationships
- **Hierarchy Visualization**: Shows agent roles and communication patterns
- **Export Capabilities**: Generate visualizations in multiple formats

### VisualizationIntegration

Coordinates between conversation tracking and visualization:

- **Real-time Updates**: Automatically update visualizations as conversations progress
- **Session Integration**: Seamlessly integrate with GroupChatManager
- **Subscription Management**: Allow real-time monitoring of conversations
- **Export Management**: Handle visualization exports and sharing
- **Error Handling**: Robust error handling and recovery

## Usage

### Basic Setup

```typescript
import { createVisualizationSystem, VisualizationPresets } from './visualization';

// Create a basic visualization system
const vizSystem = createVisualizationSystem(VisualizationPresets.BASIC);

// Create a comprehensive system
const fullSystem = createVisualizationSystem(VisualizationPresets.COMPREHENSIVE);
```

### Session Management

```typescript
// Initialize a new conversation session
const session = await vizSystem.createSession(
  'session-123',
  CollaborationPattern.DEBATE,
  [
    { agentName: 'moderator', role: 'moderator', capabilities: ['facilitation'] },
    { agentName: 'expert-1', role: 'specialist', capabilities: ['analysis'] },
    { agentName: 'expert-2', role: 'specialist', capabilities: ['critique'] }
  ]
);

// Add conversation turns
await vizSystem.addTurn('session-123', {
  role: 'assistant',
  content: 'Let me start the debate...',
  timestamp: new Date().toISOString(),
  agentId: 'moderator'
}, {
  toolsUsed: ['facilitation-tools'],
  patternPhase: 'opening'
});

// Complete the session
await vizSystem.completeSession('session-123');
```

### Visualization Generation

```typescript
// Generate timeline visualization
const timeline = await vizSystem.generateVisualization('session-123', 'timeline');

// Generate all visualizations
const allViz = await vizSystem.generateVisualization('session-123', 'all');

// Export visualization
const exportData = await vizSystem.exportVisualization(timeline.requestId, 'json');
```

### Real-time Monitoring

```typescript
// Subscribe to session updates
integration.subscribeToSession('session-123', 'monitor-1');

// Listen for visualization updates
integration.on('visualizations-updated', (event) => {
  console.log(`Session ${event.sessionId} visualizations updated`);
});

// Get session analytics
const analytics = vizSystem.getSessionAnalytics('session-123');
console.log(`Complexity: ${analytics.session?.statistics.complexity}`);
```

## Configuration Presets

### BASIC
- Lightweight timeline tracking
- No real-time updates
- Minimal resource usage

### COMPREHENSIVE
- Full visualization suite
- Real-time updates enabled
- Maximum analysis capabilities

### HIGH_PERFORMANCE
- Optimized for high-volume scenarios
- Reduced memory footprint
- Batch processing

### REAL_TIME
- Live monitoring optimized
- Fast update intervals
- Immediate feedback

## Data Models

### ConversationSession
```typescript
interface ConversationSession {
  id: string;
  name: string;
  pattern: CollaborationPattern;
  participants: AgentParticipation[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'archived';
  turns: ConversationTurn[];
  threads: ConversationThread[];
  flow: ConversationFlow;
  statistics: ConversationStatistics;
}
```

### ConversationTurn
```typescript
interface ConversationTurn {
  id: string;
  message: ConversationMessage;
  sequenceNumber: number;
  turnDuration: number;
  metadata: {
    patternPhase?: string;
    toolsUsed?: string[];
    contextReferences?: string[];
    responseTime?: number;
    tokenCount?: number;
  };
}
```

### VisualizationGraph
```typescript
interface VisualizationGraph {
  id: string;
  sessionId: string;
  type: 'timeline' | 'flow' | 'network' | 'hierarchy';
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  layout: LayoutConfiguration;
  metadata: VisualizationMetadata;
}
```

## Performance Considerations

### Memory Management
- Automatic cleanup of expired data
- Configurable retention policies
- Compression for large conversations

### Optimization Features
- Query result caching
- Indexed lookups by type, agent, and time
- Lazy loading of visualization data

### Scalability
- Batch processing for large datasets
- Configurable limits and thresholds
- Resource usage monitoring

## Integration Points

### GroupChatManager
- Automatic session initialization
- Real-time turn processing
- Session completion handling

### ContextManager
- Context reference tracking
- Shared knowledge visualization
- Conflict detection display

### ToolRegistry
- Tool usage analytics
- Performance visualization
- Resource utilization tracking

## Export Formats

### JSON
Complete data export with full metadata

### CSV
Tabular data for analysis tools

### Markdown
Human-readable conversation reports

### SVG/PNG/PDF
Visual chart exports (future implementation)

## Error Handling

The system includes comprehensive error handling:

- **Validation Errors**: Input validation and sanitization
- **Resource Errors**: Memory and storage limit handling
- **Integration Errors**: Graceful degradation when components fail
- **Export Errors**: Robust error recovery during data export

## Testing

The module includes comprehensive test coverage:

- Unit tests for all core components (26 tests)
- Integration tests for component interaction
- Performance tests for scalability
- Error condition testing

Run tests with:
```bash
npm test -- --run src/autogen/__tests__/visualization/
```

## Future Enhancements

1. **Advanced Analytics**
   - Sentiment analysis integration
   - Pattern recognition algorithms
   - Predictive conversation modeling

2. **Enhanced Visualizations**
   - 3D network graphs
   - Interactive timeline controls
   - Custom visualization templates

3. **Real-time Collaboration**
   - Live shared viewing
   - Collaborative annotation
   - Multi-user session monitoring

4. **AI-Powered Insights**
   - Automated conversation summarization
   - Key insight extraction
   - Conversation quality metrics