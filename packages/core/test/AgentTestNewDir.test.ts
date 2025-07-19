import { describe, it, expect } from 'vitest';

describe('Agent Test in New Directory', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should pass another simple test', () => {
    expect('hello').toBe('hello');
  });
});
