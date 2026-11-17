import { Command } from 'commander';

export function createProgram(): Command {
  const program = new Command();
  program.name('worker').description('WildWindow worker CLI').version('0.0.0');

  program
    .command('hello')
    .description('Sanity-check command')
    .action(() => {
      console.log('ok');
    });

  return program;
}

export function listCommands(program: Command): string[] {
  return program.commands.map((command) => command.name());
}
