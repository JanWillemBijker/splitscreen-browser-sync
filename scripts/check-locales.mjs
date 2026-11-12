// Development check (not packaged): every locale has exactly the keys of
// _locales/en, the same placeholders, and store/manifest limits are met.
// Usage: node scripts/check-locales.mjs [--lengths]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '_locales');
const load = (lang) => JSON.parse(readFileSync(join(root, lang, 'messages.json'), 'utf8'));
const tokens = (text) => [...String(text).matchAll(/\$([A-Za-z0-9_@]+)\$/g)].map((m) => m[1].toLowerCase()).sort();
const showLengths = process.argv.includes('--lengths');

const en = load('en');
const enKeys = Object.keys(en);
let problems = 0;
const report = (lang, text) => { problems += 1; console.log(`${lang}: ${text}`); };

for (const lang of readdirSync(root).sort()) {
  const messages = load(lang);
  const keys = Object.keys(messages);
  for (const key of enKeys) if (!keys.includes(key)) report(lang, `missing ${key}`);
  for (const key of keys) if (!enKeys.includes(key)) report(lang, `extra ${key}`);

  for (const key of enKeys) {
    const entry = messages[key];
    if (!entry) continue;
    if (typeof entry.message !== 'string' || !entry.message.trim()) { report(lang, `${key}: empty message`); continue; }
    const want = en[key].placeholders || {};
    const have = entry.placeholders || {};
    const wantNames = Object.keys(want).map((n) => n.toLowerCase()).sort();
    const haveNames = Object.keys(have).map((n) => n.toLowerCase()).sort();
    if (wantNames.join() !== haveNames.join()) report(lang, `${key}: placeholders ${haveNames} != ${wantNames}`);
    for (const [name, spec] of Object.entries(want)) {
      const other = Object.entries(have).find(([n]) => n.toLowerCase() === name.toLowerCase())?.[1];
      if (other && other.content !== spec.content) report(lang, `${key}: placeholder ${name} content ${other.content} != ${spec.content}`);
    }
    if (tokens(entry.message).join() !== tokens(en[key].message).join()) {
      report(lang, `${key}: uses $..$ ${tokens(entry.message)} but en uses ${tokens(en[key].message)}`);
    }
    if (showLengths && lang !== 'en' && en[key].message.length >= 8 && entry.message.length > en[key].message.length * 1.6) {
      console.log(`  (long) ${lang} ${key}: ${entry.message.length} vs en ${en[key].message.length}`);
    }
  }

  const name = messages.extName?.message || '';
  const description = messages.extDescription?.message || '';
  if (name.length > 75) report(lang, `extName is ${name.length} chars (max 75)`);
  if (description.length > 132) report(lang, `extDescription is ${description.length} chars (max 132)`);
  const csv = messages.csvHeader?.message || '';
  if (csv.split(',').length !== en.csvHeader.message.split(',').length) report(lang, 'csvHeader needs the same number of columns as en');
  console.log(`${lang}: ${keys.length} keys, description ${description.length} chars`);
}

if (problems) {
  console.log(`\n${problems} problem(s)`);
  process.exit(1);
}
console.log('\nAll locales match en.');
