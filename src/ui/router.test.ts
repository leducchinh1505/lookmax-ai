import { describe, expect, it } from 'vitest';
import { parse } from './router';

describe('hash router', () => {
  it('parses routes', () => {
    expect(parse('')).toEqual({ name: 'dashboard' });
    expect(parse('#new')).toEqual({ name: 'new' });
    expect(parse('#/plan')).toEqual({ name: 'plan' });
    expect(parse('#analysis/abc')).toEqual({ name: 'analysis', id: 'abc' });
    expect(parse('#analysis')).toEqual({ name: 'analysis', id: null });
    expect(parse('#nope')).toEqual({ name: 'dashboard' });
  });
});
