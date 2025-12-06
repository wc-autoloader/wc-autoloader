import { describe, it, expect } from 'vitest';
import { load } from '../src/webc';

describe('webc loader', () => {
  it('should have load function', () => {
    expect(load).toBeDefined();
    expect(typeof load).toBe('function');
  });
});
