import { describe, expect, it } from 'vitest';

import { createProgram, listCommands } from './commands.js';

describe('worker command registry', () => {
  it('createProgram succeeds (commander must expose requiredOption)', () => {
    // Railway post-#28 crash: root-hoisted commander@2 has no requiredOption,
    // so createProgram throws TypeError during command registration.
    expect(() => createProgram()).not.toThrow();
  });

  it('registers hello, gbif commands, aggregate, score:refs, backtest, make-admin and purge-deleted', () => {
    const program = createProgram();
    const names = listCommands(program);
    expect(names).toContain('hello');
    expect(names).toContain('gbif:request');
    expect(names).toContain('gbif:fetch');
    expect(names).toContain('gbif:load');
    expect(names).toContain('aggregate');
    expect(names).toContain('score:refs');
    expect(names).toContain('backtest');
    expect(names).toContain('make-admin');
    expect(names).toContain('purge-deleted');
  });
});
