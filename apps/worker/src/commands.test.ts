import { describe, expect, it } from 'vitest';

import { createProgram, listCommands } from './commands.js';

describe('worker command registry', () => {
  it('registers hello, gbif commands and aggregate', () => {
    const program = createProgram();
    const names = listCommands(program);
    expect(names).toContain('hello');
    expect(names).toContain('gbif:request');
    expect(names).toContain('gbif:fetch');
    expect(names).toContain('gbif:load');
    expect(names).toContain('aggregate');
    expect(names).toContain('score:refs');
  });
});
