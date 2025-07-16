/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { TaskProgressBar } from '../TaskProgressBar.js';

describe('TaskProgressBar Component', () => {
  it('renders basic task progress correctly', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-123"
        title="Implement user authentication"
        status="in-progress"
        progress={75}
        showDependencies={false}
      />
    );

    expect(lastFrame()).toContain('⚡'); // in-progress icon
    expect(lastFrame()).toContain('TASK-123');
    expect(lastFrame()).toContain('Implement user authentication');
    expect(lastFrame()).toContain('75%');
    expect(lastFrame()).toContain('IN-PROGRESS');
  });

  it('renders completed task correctly', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-456"
        title="Setup database connection"
        status="completed"
        progress={100}
        showDependencies={false}
      />
    );

    expect(lastFrame()).toContain('✓'); // completed icon
    expect(lastFrame()).toContain('100%');
    expect(lastFrame()).toContain('COMPLETED');
  });

  it('renders blocked task correctly', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-789"
        title="Deploy to production"
        status="blocked"
        progress={0}
        showDependencies={false}
      />
    );

    expect(lastFrame()).toContain('🚫'); // blocked icon
    expect(lastFrame()).toContain('0%');
    expect(lastFrame()).toContain('BLOCKED');
  });

  it('renders pending task correctly', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-101"
        title="Write unit tests"
        status="pending"
        progress={0}
        showDependencies={false}
      />
    );

    expect(lastFrame()).toContain('○'); // pending icon
    expect(lastFrame()).toContain('0%');
    expect(lastFrame()).toContain('PENDING');
  });

  it('shows assigned agent when provided', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-202"
        title="Code review"
        status="in-progress"
        progress={50}
        assignedAgent="senior-dev"
        showDependencies={false}
      />
    );

    expect(lastFrame()).toContain('[@senior-dev]');
  });

  it('shows estimated time when provided', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-303"
        title="Performance optimization"
        status="in-progress"
        progress={30}
        estimatedTime="2h 30m"
        showDependencies={false}
      />
    );

    expect(lastFrame()).toContain('~2h 30m');
  });

  it('shows dependencies when enabled', () => {
    const dependencies = [
      { id: 'TASK-001', title: 'Setup environment', status: 'completed' as const },
      { id: 'TASK-002', title: 'Install dependencies', status: 'in-progress' as const }
    ];

    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-404"
        title="Start development"
        status="pending"
        progress={0}
        dependencies={dependencies}
        showDependencies={true}
      />
    );

    expect(lastFrame()).toContain('Dependencies:');
    expect(lastFrame()).toContain('✓ TASK-001');
    expect(lastFrame()).toContain('⚡ TASK-002');
  });

  it('shows blocked dependencies warning', () => {
    const dependencies = [
      { id: 'TASK-001', title: 'Setup environment', status: 'completed' as const },
      { id: 'TASK-002', title: 'Get API keys', status: 'blocked' as const },
      { id: 'TASK-003', title: 'Configure database', status: 'pending' as const }
    ];

    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-505"
        title="Start API integration"
        status="blocked"
        progress={0}
        dependencies={dependencies}
        showDependencies={true}
      />
    );

    expect(lastFrame()).toContain('⚠️  Blocked by:');
    expect(lastFrame()).toContain('TASK-002, TASK-003');
  });

  it('renders progress bar with correct fill', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-606"
        title="Progress test"
        status="in-progress"
        progress={50}
        showDependencies={false}
      />
    );

    const frame = lastFrame();
    // Should contain progress bar with filled and empty parts
    expect(frame).toContain('█'); // filled part
    expect(frame).toContain('░'); // empty part
    expect(frame).toContain('['); // progress bar start
    expect(frame).toContain(']'); // progress bar end
  });

  it('handles zero progress correctly', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-707"
        title="Not started"
        status="pending"
        progress={0}
        showDependencies={false}
      />
    );

    expect(lastFrame()).toContain('0%');
    expect(lastFrame()).toContain('░░░░░░░░░░░░░░░░░░░░'); // all empty
  });

  it('handles full progress correctly', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-808"
        title="Completed task"
        status="completed"
        progress={100}
        showDependencies={false}
      />
    );

    expect(lastFrame()).toContain('100%');
    expect(lastFrame()).toContain('████████████████████'); // all filled
  });

  it('hides dependencies when showDependencies is false', () => {
    const dependencies = [
      { id: 'TASK-001', title: 'Setup environment', status: 'completed' as const }
    ];

    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-909"
        title="Hidden deps test"
        status="pending"
        progress={0}
        dependencies={dependencies}
        showDependencies={false}
      />
    );

    expect(lastFrame()).not.toContain('Dependencies:');
    expect(lastFrame()).not.toContain('TASK-001');
  });

  it('handles empty dependencies array', () => {
    const { lastFrame } = render(
      <TaskProgressBar
        taskId="TASK-010"
        title="No dependencies"
        status="in-progress"
        progress={25}
        dependencies={[]}
        showDependencies={true}
      />
    );

    expect(lastFrame()).not.toContain('Dependencies:');
    expect(lastFrame()).not.toContain('Blocked by:');
  });
});