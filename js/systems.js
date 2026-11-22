export const SYSTEMS = [
  {
    id: 'snes',
    name: 'Super Nintendo (SNES)',
    short: 'SNES',
    core: 'snes',
    extensions: ['.sfc', '.smc', '.fig', '.swc'],
    color: '#7c5cff',
    accent: '#b794ff',
    badgeBg: 'rgba(124, 92, 255, 0.22)',
    examples: 'Super Mario World, Super Mario Kart, Donkey Kong Country, Prince of Persia',
    year: '1990',
    icon: '🎮'
  },
  {
    id: 'nes',
    name: 'Nintendo NES',
    short: 'NES',
    core: 'nes',
    extensions: ['.nes', '.fds', '.unif', '.unf'],
    color: '#ef4444',
    accent: '#fca5a5',
    badgeBg: 'rgba(239, 68, 68, 0.22)',
    examples: 'Super Mario Bros. 1/3, Donkey Kong, Zelda, Prince of Persia',
    year: '1983',
    icon: '🕹️'
  },
  {
    id: 'gba',
    name: 'Game Boy Advance',
    short: 'GBA',
    core: 'gba',
    extensions: ['.gba'],
    color: '#6366f1',
    accent: '#a5b4fc',
    badgeBg: 'rgba(99, 102, 241, 0.22)',
    examples: 'Mario Kart: Super Circuit, Donkey Kong Country, Metroid Fusion',
    year: '2001',
    icon: '📱'
  },
  {
    id: 'gb',
    name: 'Game Boy / Color',
    short: 'GB / GBC',
    core: 'gb',
    extensions: ['.gb', '.gbc'],
    color: '#22c55e',
    accent: '#86efac',
    badgeBg: 'rgba(34, 197, 94, 0.22)',
    examples: 'Super Mario Land, Donkey Kong 94, Tetris, Pokémon',
    year: '1989',
    icon: '🟩'
  },
  {
    id: 'n64',
    name: 'Nintendo 64',
    short: 'N64',
    core: 'n64',
    extensions: ['.n64', '.z64', '.v64'],
    color: '#eab308',
    accent: '#fde047',
    badgeBg: 'rgba(234, 179, 8, 0.22)',
    examples: 'Super Mario 64, Mario Kart 64, Donkey Kong 64',
    year: '1996',
    icon: '⭐'
  },
  {
    id: 'nds',
    name: 'Nintendo DS',
    short: 'NDS',
    core: 'nds',
    extensions: ['.nds'],
    color: '#38bdf8',
    accent: '#7dd3fc',
    badgeBg: 'rgba(56, 189, 248, 0.22)',
    examples: 'New Super Mario Bros., Mario Kart DS, Chrono Trigger',
    year: '2004',
    icon: '📺'
  },
  {
    id: 'segaMD',
    name: 'Sega Genesis / Mega Drive',
    short: 'GENESIS',
    core: 'segaMD',
    extensions: ['.md', '.gen', '.smd'],
    color: '#0ea5e9',
    accent: '#7dd3fc',
    badgeBg: 'rgba(14, 165, 233, 0.22)',
    examples: 'Sonic the Hedgehog, Streets of Rage, Prince of Persia',
    year: '1988',
    icon: '⚡'
  },
  {
    id: 'segaMS',
    name: 'Sega Master System / GG',
    short: 'SMS / GG',
    core: 'segaMS',
    extensions: ['.sms', '.gg'],
    color: '#f97316',
    accent: '#fdba74',
    badgeBg: 'rgba(249, 115, 22, 0.22)',
    examples: 'Alex Kidd, Sonic, Wonder Boy',
    year: '1985',
    icon: '🔥'
  },
  {
    id: 'psx',
    name: 'PlayStation (PS1)',
    short: 'PS1',
    core: 'psx',
    extensions: ['.chd', '.pbp', '.cue', '.iso'],
    color: '#94a3b8',
    accent: '#cbd5e1',
    badgeBg: 'rgba(148, 163, 184, 0.22)',
    examples: 'Crash Team Racing, Spyro, Tekken 3, Castlevania SOTN',
    year: '1994',
    icon: '💿'
  },
  {
    id: 'arcade',
    name: 'Arcade (MAME / FBNeo)',
    short: 'ARCADE',
    core: 'arcade',
    extensions: ['.zip'],
    color: '#ec4899',
    accent: '#f9a8d4',
    badgeBg: 'rgba(236, 72, 153, 0.22)',
    examples: 'Donkey Kong Arcade, Pac-Man, Metal Slug, Street Fighter II',
    year: '1980s',
    icon: '👾'
  }
];

export const SYSTEM_MAP = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

export function getSystemById(id) {
  return SYSTEM_MAP[id] || SYSTEM_MAP.snes;
}

export function getExtension(filename = '') {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

export function cleanGameTitle(filename = '') {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || filename;
}

export function formatBytes(bytes = 0) {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

/**
 * Detect system by filename extension or folder hint.
 */
export function detectSystemFromFilename(filename, folderHint = '') {
  const ext = getExtension(filename);

  // Exact match for non-zip extensions
  if (ext && ext !== '.zip') {
    for (const sys of SYSTEMS) {
      if (sys.extensions.includes(ext)) {
        return sys.id;
      }
    }
  }

  // Folder hint (e.g. roms/snes/game.zip)
  const hint = `${folderHint} ${filename}`.toLowerCase();
  if (/\b(snes|sfc|super\s?nintendo)\b/.test(hint)) return 'snes';
  if (/\b(nes|famicom)\b/.test(hint)) return 'nes';
  if (/\b(gba|advance)\b/.test(hint)) return 'gba';
  if (/\b(gbc|gb|game\s?boy)\b/.test(hint)) return 'gb';
  if (/\b(n64|nintendo\s?64)\b/.test(hint)) return 'n64';
  if (/\b(nds|ds)\b/.test(hint)) return 'nds';
  if (/\b(genesis|megadrive|md|sega)\b/.test(hint)) return 'segaMD';
  if (/\b(sms|mastersystem|gamegear|gg)\b/.test(hint)) return 'segaMS';
  if (/\b(psx|ps1|playstation)\b/.test(hint)) return 'psx';
  if (ext === '.zip') return 'arcade';

  return null;
}

/**
 * Peeks inside the first local file header of a ZIP Blob/File to inspect
 * the embedded ROM extension (e.g., .sfc inside SuperMarioWorld.zip).
 */
export async function detectSystemFromFile(file, fallbackSystemId = null) {
  const ext = getExtension(file.name);
  if (ext !== '.zip') {
    return detectSystemFromFilename(file.name) || fallbackSystemId || 'snes';
  }

  try {
    const headerBuf = await file.slice(0, 512).arrayBuffer();
    const view = new DataView(headerBuf);
    // ZIP Local File Header signature = 0x04034b50 ("PK\x03\x04")
    if (view.byteLength >= 30 && view.getUint32(0, true) === 0x04034b50) {
      const nameLen = view.getUint16(26, true);
      if (nameLen > 0 && 30 + nameLen <= view.byteLength) {
        const nameBytes = new Uint8Array(headerBuf, 30, nameLen);
        const innerName = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);
        const innerDetected = detectSystemFromFilename(innerName);
        if (innerDetected && innerDetected !== 'arcade') {
          return innerDetected;
        }
      }
    }
  } catch {
    // Ignore zip peek failure and fall back gracefully
  }

  return detectSystemFromFilename(file.name) || fallbackSystemId || 'arcade';
}

export function getAcceptedExtensionsString() {
  const all = new Set();
  for (const sys of SYSTEMS) {
    for (const ext of sys.extensions) all.add(ext);
  }
  all.add('.zip');
  all.add('.7z');
  all.add('.bin');
  return Array.from(all).join(',');
}
