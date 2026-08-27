import { describe, it, expect } from 'vitest';
import { greeting } from '../src/greeting';

describe('greeting', () => {
  it('should return exact string "Hello from SOMA!"', () => {
    expect(greeting()).toBe('Hello from SOMA!');
  });
});
