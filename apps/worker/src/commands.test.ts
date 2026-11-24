import { describe, expect, it } from 'vitest';

import { createProgram, listCommands } from './commands.js';

describe('worker command registry', () => {
  it('registers hello, gbif:request and gbif:fetch', () => {
    const program = createProgram();
    const names = listCommands(program);
    expect(names).toContain('hello');
    expect(names).toContain('gbif:request');
    expect(names).toContain('gbif:fetch');
  });
});
