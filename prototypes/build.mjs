// Builds the prototype pages by inlining the pet art.
//   /*__AVATAR__*/      -> CHARACTERS (public/modules/core.js) + new avatar() (prototypes/pet-art.js)
//   /*__AVATAR_OLD__*/  -> current app avatar() (public/modules/character.js), renamed avatarOld()
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (u) => readFileSync(u, 'utf8').replace(/^﻿/, '');
const stripImports = (src) => src.replace(/^import [^\n]*\n/gm, '');

const core = read(new URL('public/modules/core.js', root));
const chars = core.match(/export const CHARACTERS = \{[\s\S]*?\n\};/);
if (!chars) throw new Error('CHARACTERS not found in core.js');

const newArt = stripImports(read(new URL('pet-art.js', import.meta.url))).replace(/^export /gm, '');
const oldArt = stripImports(read(new URL('public/modules/character.js', root)))
  .replace('export function avatar', 'function avatarOld')
  .replace(/\bsequence\b/g, 'oldSequence');

const hatch = read(new URL('hatch.js', import.meta.url));
const evolve = read(new URL('evolve.js', import.meta.url));

const blocks = {
  '/*__AVATAR__*/': `${chars[0].replace('export const', 'const')}\n${read(new URL('characters-extra.js', import.meta.url))}\n${newArt}`,
  '/*__HATCH__*/': hatch,
  '/*__EVOLVE__*/': evolve,
  '/*__AVATAR_OLD__*/': oldArt,
};

for (const page of ['yacha-battle', 'pet-gallery']) {
  let html = read(new URL(`${page}.template.html`, import.meta.url));
  for (const [marker, code] of Object.entries(blocks)) html = html.replace(marker, () => code);
  writeFileSync(new URL(`${page}.html`, import.meta.url), html);
  console.log(`built ${page}.html`, html.length, 'bytes');
}
