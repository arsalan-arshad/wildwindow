/**
 * Map GBIF SIMPLE_CSV `class` to our effort_group labels (beta-species.yaml).
 * Reptilia was retired in CoL 2022; successor classes map to `Reptilia`.
 */
export function effortGroupFromClass(className: string | undefined): string | undefined {
  const name = className?.trim();
  if (name === undefined || name.length === 0) {
    return undefined;
  }
  switch (name) {
    case 'Aves':
      return 'Aves';
    case 'Mammalia':
      return 'Mammalia';
    case 'Reptilia':
    case 'Squamata':
    case 'Testudines':
    case 'Crocodylia':
      return 'Reptilia';
    default:
      return undefined;
  }
}
