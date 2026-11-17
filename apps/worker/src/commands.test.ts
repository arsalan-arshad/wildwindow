import { describe, expect, it } from 'vitest';

import { createProgram, listCommands } from './commands.js';

describe('worker command registry', () => {
  it('registers the hello command', () => {
    const program = createProgram();
    expect(listCommands(program)).toContain('hello');
  });
});
