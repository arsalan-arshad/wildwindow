import { createProgram } from './commands.js';

const program = createProgram();
await program.parseAsync(process.argv);
