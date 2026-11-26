/**
 * One-shot / re-runnable generator for T8.2 draft field cards.
 * Writes `data/species-cards/<region>/<slug>.md` for every beta taxon×region.
 * Does not set reviewedBy / reviewedAt → status stays draft when loaded.
 *
 * Usage: `pnpm --filter @wildwindow/shared generate-draft-cards`
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { readFileSync } from 'node:fs';

import { BetaSpeciesFileSchema, type BetaSpeciesEntry } from '../src/data-schemas.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const dataDir = path.join(repoRoot, 'data');
const cardsRoot = path.join(dataDir, 'species-cards');

/** Scotland Schedule 1 / highly protected nesting species (from sensitive-species notes). */
const SCOTLAND_SCHEDULE1 = new Set([
  'Pandion haliaetus',
  'Haliaeetus albicilla',
  'Circus cyaneus',
  'Falco peregrinus',
  'Tetrao urogallus',
]);

type SceneSettings = {
  shutter: string;
  aperture: string;
  iso: string;
  focusMode: string;
  driveMode: string;
};

type CardSettings = {
  perched: SceneSettings;
  flight: SceneSettings;
  lowLight: SceneSettings;
};

function slugifyCommonName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function settingsFor(group: string, activity: string): CardSettings {
  const birdLike = group === 'bird';
  const marine = group === 'marine';
  const nocturnal = activity === 'nocturnal' || activity === 'crepuscular';

  if (birdLike) {
    return {
      perched: {
        shutter: '1/500',
        aperture: 'f/5.6',
        iso: '400',
        focusMode: 'AF-S / single-point',
        driveMode: 'Single',
      },
      flight: {
        shutter: '1/2000',
        aperture: 'f/5.6',
        iso: '800',
        focusMode: 'AF-C / zone or animal-eye',
        driveMode: 'Continuous high',
      },
      lowLight: {
        shutter: nocturnal ? '1/250' : '1/320',
        aperture: 'f/4',
        iso: nocturnal ? '3200' : '1600',
        focusMode: 'AF-C / flexible spot',
        driveMode: 'Continuous low',
      },
    };
  }

  if (marine) {
    return {
      perched: {
        shutter: '1/1000',
        aperture: 'f/5.6',
        iso: '400',
        focusMode: 'AF-C / animal-eye',
        driveMode: 'Continuous high',
      },
      flight: {
        shutter: '1/1600',
        aperture: 'f/5.6',
        iso: '800',
        focusMode: 'AF-C / zone',
        driveMode: 'Continuous high',
      },
      lowLight: {
        shutter: '1/500',
        aperture: 'f/4',
        iso: '1600',
        focusMode: 'AF-C / flexible spot',
        driveMode: 'Continuous low',
      },
    };
  }

  // Mammals and reptiles: perched = still subject, flight = moving subject.
  return {
    perched: {
      shutter: '1/250',
      aperture: 'f/4',
      iso: '800',
      focusMode: 'AF-S / single-point',
      driveMode: 'Single',
    },
    flight: {
      shutter: '1/1000',
      aperture: 'f/4',
      iso: '1600',
      focusMode: 'AF-C / animal-eye or zone',
      driveMode: 'Continuous high',
    },
    lowLight: {
      shutter: nocturnal ? '1/125' : '1/200',
      aperture: 'f/2.8',
      iso: nocturnal ? '6400' : '3200',
      focusMode: 'AF-C / flexible spot',
      driveMode: 'Continuous low',
    },
  };
}

function yamlScene(name: string, s: SceneSettings, indent = 2): string {
  const pad = ' '.repeat(indent);
  return [
    `${pad}${name}:`,
    `${pad}  shutter: '${s.shutter}'`,
    `${pad}  aperture: '${s.aperture}'`,
    `${pad}  iso: '${s.iso}'`,
    `${pad}  focusMode: '${s.focusMode}'`,
    `${pad}  driveMode: '${s.driveMode}'`,
  ].join('\n');
}

/** Species-specific fieldcraft drafts keyed by scientific name. */
const FIELDCRAFT: Record<string, { scotland?: string; sindh?: string; both?: string }> = {
  'Alcedo atthis': {
    scotland:
      'Work quiet burns and reeded river bends at first light. Sit low on the bank and wait for a return perch rather than stalking. Watch for a turquoise flash above still water; pre-focus on a favoured perch if you can find one without flushing the bird.',
    sindh:
      'Watch canal banks, mangrove edges and still backwaters in early light. Keep distance from roosts and fishing perches. A low angle from the bank often beats a standing silhouette against bright water.',
  },
  'Sciurus vulgaris': {
    scotland:
      'Scan Scots pine and mixed woodland edges after sunrise when squirrels forage. Move slowly; use a long lens from a trail rather than chasing through understorey. Soft overcast helps fur detail without harsh contrast.',
  },
  'Halichoerus grypus': {
    scotland:
      'Photograph from a respectful distance on beaches and skerries; never approach haul-outs on foot for a closer frame. Use a long lens from a path or boat that is already on a public route. Watch tide and wind so you are not cut off or forcing seals into the water.',
  },
  'Lutra lutra': {
    scotland:
      'Look for sprainting sites and quiet shores at dawn and dusk, but stay well back. Otters are easily disturbed; a long lens from cover beats a close approach. Do not follow an animal along a bank or wait at a holt.',
  },
  'Lepus timidus': {
    scotland:
      'Hill and moorland edges at first and last light. Keep to paths where you can; mountain hares flush easily on open ground. Use the landform as a hide and avoid chasing animals for a shot.',
  },
  'Pandion haliaetus': {
    scotland:
      'Watch known fishing waters from a distance with a long lens. Never approach nest platforms or trees in the breeding season — Schedule 1 nesting birds need a NatureScot licence for photography at or near the nest. Favour flight and fishing behaviour well away from nest sites.',
  },
  'Haliaeetus albicilla': {
    scotland:
      'Coastal cliffs and sea lochs: work from public viewpoints with a long lens. Give nests and roosts a wide berth year-round, especially in the long breeding lockout. Flight silhouettes against sea and sky are safer than any approach to a nest cliff.',
  },
  'Tetrao urogallus': {
    scotland:
      'Capercaillie are extremely sensitive to disturbance, especially at leks. Do not visit lekking grounds for photographs; social sharing of lek sites has already drawn harmful crowds in Scotland. Prefer habitat context shots only where the species is not present, or skip the species entirely if you cannot work without risk of disturbance.',
  },
  'Cervus elaphus': {
    scotland:
      'Forest rides and hill edges at dawn and dusk. Stay downwind when you can and use a long lens from cover. In the rut, keep extra distance from stags and never drive animals for a photo.',
  },
  'Capreolus capreolus': {
    scotland:
      'Woodland edges and field margins in soft light. Roe deer freeze then bolt; a patient wait from a field boundary beats stalking through cover. Avoid following animals into thickets.',
  },
  'Vulpes vulpes': {
    scotland:
      'Dusk and dawn along field edges and quiet tracks. Red foxes are often nocturnal in busy areas — use available light and a long lens rather than lamps. Never bait dens or cubs for photographs.',
  },
  'Meles meles': {
    scotland:
      'Sett entrances at last light only from a safe, distant vantage. Do not sit on or near sett mounds, dig, or use lights that point into holes. If a badger changes course, you are too close — pull back.',
  },
  'Martes martes': {
    scotland:
      'Forest edges and quiet trails at dawn. Pine martens are shy and mostly nocturnal; a trail camera ethic (no baiting for stills) applies equally to hand-held work. Prefer opportunistic sightings over staking dens.',
  },
  'Phoca vitulina': {
    scotland:
      'Harbour seals haul out on sandbanks and rocks — photograph from afar with a long lens. Never walk between a seal and the water or land near pups. Boat approaches should stay outside disturbance distance and follow local wildlife-watching codes.',
  },
  'Ardea cinerea': {
    scotland:
      'Still water margins and tidal edges. Grey herons are patient hunters; match that patience from a low bank position. Avoid flushing birds from communal roosts or heronries.',
  },
  'Circus cyaneus': {
    scotland:
      'Open moor and rough grassland: watch quartering flight from a distant ridge or road pull-in. Never approach nests on the ground — Schedule 1. If a harrier starts alarm-calling or circling you, leave immediately.',
  },
  'Falco peregrinus': {
    scotland:
      'Cliff and quarry overlooks with a long lens. Do not linger below nest ledges in the breeding season (Schedule 1). Flight and hunting behaviour away from nest cliffs is the ethical frame.',
  },
  'Fratercula arctica': {
    scotland:
      'Seabird cliffs from marked paths and viewing areas only. Keep back from burrow edges; collapsing soil harms nests and people. Mid-morning light on cliff faces often beats harsh midday.',
  },
  'Uria aalge': {
    scotland:
      'Photograph ledges from designated viewpoints. Dense colonies look dramatic — use a longer lens and avoid leaning over cliff edges. Never throw objects or make noise to flush birds for flight shots.',
  },
  'Gavia immer': {
    scotland:
      'Large lochs and coastal waters. Keep well back from nesting shores; divers are sensitive to boats and shore walkers near nests. Calm water at dawn gives clean reflections without chasing birds.',
  },
  'Cygnus cygnus': {
    scotland:
      'Winter wetlands and flooded fields. Whooper swans need space to take off; do not corner flocks against fences or roads. A long lens from a bank or hide keeps you out of their flight path.',
  },
  'Anser anser': {
    scotland:
      'Dawn flights from roosts to feeding fields — work from field edges, not inside flocks. Avoid flushing geese repeatedly for wing-beat shots; one careful sequence is enough.',
  },
  'Erinaceus europaeus': {
    scotland:
      'Garden edges and quiet paths after dusk. Use a red-filtered lamp sparingly if at all; prefer ambient light. Never handle hedgehogs for a photo and keep dogs away while you work.',
  },
  'Mustela erminea': {
    scotland:
      'Stone walls, dykes and field edges in good daylight. Stoats move fast — pre-focus on likely hunting lines and wait. Do not dig out or block rabbit holes to force an appearance.',
  },
  'Buteo buteo': {
    scotland:
      'Thermal soarers over farmland and hills. A roadside pull-in with a long lens often beats walking under a perch tree. Leave occupied nests alone and skip playback entirely.',
  },
  'Haematopus ostralegus': {
    scotland:
      'Tide edges and mussel beds. Work with the tide so birds come to you; rushing mudflats flushes everything. Keep clear of nest scrapes on shingle in the breeding season.',
  },
  'Psittacula krameri': {
    sindh:
      'City parks, orchards and canal-side trees at dawn when flocks are vocal. Use a long lens from open ground; do not climb trees or shake branches for flight shots. Avoid nesting cavities in the breeding season.',
  },
  'Lutrogale perspicillata': {
    sindh:
      'Quiet river and canal banks at first and last light. Smooth-coated otters are protected — stay well back from holts and family groups. Never bait with fish or follow animals along the bank for a closer frame.',
  },
  'Platanista gangetica': {
    sindh:
      'Indus mainstem and connected channels from a boat or bank already in use by local traffic. Do not chase surfacing dolphins; shut engines when animals are close and follow provincial viewing rules. Never attempt to swim with or feed dolphins for photographs.',
  },
  'Chelonia mydas': {
    sindh:
      'Nesting beaches are highly sensitive. Do not walk nesting strands at night for photographs without authorised guidance; lights and footprints harm hatchlings. Prefer daytime in-water or distant coastal context only where legal and guided.',
  },
  'Axis axis': {
    sindh:
      'Forest edges and clearings at dawn. Chital are alert — use cover and a long lens rather than walking straight in. Keep distance from fawns and never drive herds for a stampede shot.',
  },
  'Sus scrofa': {
    sindh:
      'Woodland margins and crop edges at dusk. Wild boar can be dangerous; work from a vehicle or solid cover with a long lens. Never approach sounders with young.',
  },
  'Canis aureus': {
    sindh:
      'Open scrub and field edges after dusk. Jackals are wary — ambient light and patience beat spotlights. Do not bait dens or cubs for photographs.',
  },
  'Felis chaus': {
    sindh:
      'Wetland and scrub edges at dawn and dusk. Jungle cats flush easily; a distant wait near reed lines is safer than stalking. Leave dens alone and skip any call playback.',
  },
  'Hyaena hyaena': {
    sindh:
      'Arid scrub and night routes with a local guide where access is legal. Striped hyenas are shy and protected in practice — extreme distance, no baiting, no den approaches. Prefer tracks and habitat context if the animal is not calmly visible.',
  },
  'Gazella bennettii': {
    sindh:
      'Open desert scrub in soft morning light. Chinkara spook at long range; use a long lens from a vehicle track rather than walking them down. Never chase for flight (running) shots.',
  },
  'Porphyrio poliocephalus': {
    sindh:
      'Reedbed edges and wetland margins. Move slowly; swamphen often freeze then run. A low angle along open water beats crashing through reeds.',
  },
  'Phoenicopterus roseus': {
    sindh:
      'Shallow lagoons and salt flats from established viewing points. Flamingos flush in mass — keep well back and avoid walking into the shallows toward the flock. Heat haze rises after mid-morning; favour early light.',
  },
  'Pelecanus onocrotalus': {
    sindh:
      'Large wetlands and lakeshores. Pelicans need long takeoff runs; do not stand between birds and open water. A long lens from the bank keeps disturbance low.',
  },
  'Haliaeetus leucoryphus': {
    sindh:
      "Large rivers and lakes with a long lens from the bank or boat. Pallas's fish-eagle is highly sensitive — never approach nest trees, especially in the breeding lockout months. Flight and fishing frames far from nests are the ethical choice.",
  },
  'Grus grus': {
    sindh:
      'Winter wetlands and open fields at dawn. Cranes are vocal and wary; work from field edges and stop if the flock lifts. Do not use playback or drones near roosts.',
  },
  'Bubulcus ibis': {
    sindh:
      'Grazing fields and wetland edges where cattle egrets follow livestock. Soft light helps white plumage; expose for the bird, not the sky. Avoid nesting colonies if birds lift as you approach.',
  },
  'Egretta garzetta': {
    sindh:
      'Shallow margins and tide pools. Little egrets hunt patiently — match that pace from a low crouch. Keep clear of mixed heronries in the breeding season.',
  },
  'Crocodylus palustris': {
    sindh:
      'Riverbanks and marsh edges from a safe elevated or distant viewpoint. Mugger crocodiles are dangerous at close range — never approach the waterline for a wider lens. Use a long lens and local knowledge of basking spots that are already visible from public ground.',
  },
  'Lissemys punctata': {
    sindh:
      'Quiet pond and canal banks when flapshell turtles bask. Approach slowly or wait from cover; sudden movement sends them into the water. Do not handle or flip turtles for a shell shot.',
  },
  'Naja naja': {
    sindh:
      'Only photograph Indian cobras at a safe distance with a long lens, preferably with an experienced local herpetologist. Never provoke a hood display for a photo. If you lack snake experience, skip opportunistic close work entirely.',
  },
  'Ortygornis pondicerianus': {
    sindh:
      'Dry scrub and field edges at dawn when francolins call. Walk slowly and stop often; birds freeze then burst. Avoid flushing the same covey repeatedly.',
  },
  'Pavo cristatus': {
    sindh:
      'Village edges, orchards and open woodland at first light when peafowl display. Keep distance during courtship; do not circle a displaying male so closely that he stops. Soft light helps iridescence without blown highlights.',
  },
  'Tadorna ferruginea': {
    sindh:
      'Rivers, lakes and open wetlands. Ruddy shelduck are wary — a long lens from the bank is enough. Avoid nesting banks and islands in the breeding season.',
  },
  'Anastomus oscitans': {
    sindh:
      'Shallow wetlands and snail-rich margins. Openbills often feed in loose groups; a patient low angle works well. Do not wade into feeding flocks to force flight.',
  },
  'Circus aeruginosus': {
    sindh:
      'Reedbed and marsh edges while harriers quarter. Watch from a dyke or track with a long lens. Leave reedbed nests alone and never use playback to pull a bird closer.',
  },
};

function fieldcraftFor(species: BetaSpeciesEntry, region: string): string {
  const entry = FIELDCRAFT[species.scientificName];
  if (entry === undefined) {
    throw new Error(`Missing fieldcraft draft for ${species.scientificName}`);
  }
  if (entry.both !== undefined) {
    return entry.both;
  }
  const regional = region === 'scotland' ? entry.scotland : entry.sindh;
  if (regional === undefined) {
    throw new Error(`Missing ${region} fieldcraft for ${species.scientificName}`);
  }
  return regional;
}

function ethicsMd(group: string): string {
  const subject =
    group === 'bird'
      ? 'birds'
      : group === 'mammal' || group === 'marine'
        ? 'mammals and other wildlife'
        : 'wildlife';
  return [
    `Follow the Audubon Guide to Ethical Bird Photography (same principles for ${subject}):`,
    '- No baiting or luring for photographs',
    '- No playback of calls or song for photographs',
    '- Keep your distance; if the animal changes behaviour, you are too close',
    '- Leave nests, dens, haul-outs, leks and young alone',
    '- Share locations only at the coarseness WildWindow allows (No-Pin Promise)',
  ].join('\n');
}

function legalMd(species: BetaSpeciesEntry, region: string): string {
  if (region === 'scotland') {
    if (SCOTLAND_SCHEDULE1.has(species.scientificName)) {
      return [
        'Scotland: this species is treated as Schedule 1 / highly sensitive for nesting.',
        'Photography at or near the nest requires a NatureScot licence under the Wildlife and Countryside Act 1981 (as amended in Scotland).',
        'Stay away from nests, leks and dependent young; follow the Scottish Outdoor Access Code.',
        'Draft wording — confirm with NatureScot guidance before treating as legal advice (PRD E8).',
      ].join(' ');
    }
    return [
      'Scotland: follow the Wildlife and Countryside Act 1981 (as amended in Scotland) and the Scottish Outdoor Access Code.',
      'If this species is Schedule 1, photography at or near the nest needs a NatureScot licence — when unsure, assume a licence is required and keep well away from nests.',
      'Draft wording — confirm before launch (PRD E8).',
    ].join(' ');
  }
  return [
    'Sindh: follow provincial wildlife protection rules and protected-area permit requirements.',
    'Do not enter restricted reserves or nesting beaches without the required permit.',
    'Draft wording — get exact legal references checked before launch (PRD E8).',
  ].join(' ');
}

function sourcesMd(species: BetaSpeciesEntry, region: string): string {
  const lines = [
    '## Sources',
    '',
    '- National Audubon Society — Guide to Ethical Bird Photography (no baiting, no playback, distance, leave nests alone)',
    '- WildWindow PRD E7 (field ethics) and E8 (regional legal notes)',
    `- Beta species entry: \`${species.scientificName}\` / ${region} (\`data/beta-species.yaml\`)`,
  ];
  if (region === 'scotland' && SCOTLAND_SCHEDULE1.has(species.scientificName)) {
    lines.push(
      '- NatureScot / Wildlife and Countryside Act 1981 (as amended in Scotland) — Schedule 1 nest photography licensing',
    );
  }
  if (region === 'sindh') {
    lines.push(
      '- Sindh provincial wildlife protection / protected-area permit rules (wording pending legal review)',
    );
  }
  lines.push(
    '- Status: **draft** — needs Arsalan + expert photographer review before `reviewed` (T8.2)',
  );
  return lines.join('\n');
}

function renderCard(species: BetaSpeciesEntry, region: string): string {
  const common = species.commonNames.en;
  const settings = settingsFor(species.group, species.activityPattern);
  const body = [
    `## Fieldcraft`,
    '',
    fieldcraftFor(species, region),
    '',
    `Scene keys: **perched** (still / portrait), **flight** (moving / airborne), **low light** (dawn, dusk or night). Starting points only — expose for the subject and respect local light.`,
    '',
    sourcesMd(species, region),
    '',
  ].join('\n');

  const ethics = ethicsMd(species.group);
  const legal = legalMd(species, region);

  return [
    '---',
    `scientificName: ${species.scientificName}`,
    'settings:',
    yamlScene('perched', settings.perched),
    yamlScene('flight', settings.flight),
    yamlScene('lowLight', settings.lowLight),
    'ethicsMd: |',
    ...ethics.split('\n').map((line) => `  ${line}`),
    'legalMd: |',
    ...legal.split('\n').map((line) => `  ${line}`),
    '---',
    '',
    body,
  ].join('\n');
}

async function main(): Promise<void> {
  const raw: unknown = parseYaml(readFileSync(path.join(dataDir, 'beta-species.yaml'), 'utf8'));
  const beta = BetaSpeciesFileSchema.parse(raw);

  let written = 0;
  for (const region of ['scotland', 'sindh'] as const) {
    await mkdir(path.join(cardsRoot, region), { recursive: true });
  }

  for (const species of beta.species) {
    const slug = slugifyCommonName(species.commonNames.en);
    for (const region of species.regions) {
      const filePath = path.join(cardsRoot, region, `${slug}.md`);
      const md = renderCard(species, region);
      await writeFile(filePath, md, 'utf8');
      written += 1;
      // eslint-disable-next-line no-console -- CLI progress
      console.log(`wrote ${region}/${slug}.md`);
    }
  }

  // eslint-disable-next-line no-console -- CLI progress
  console.log(`Generated ${String(written)} draft species cards under ${cardsRoot}`);
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- CLI error path
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
