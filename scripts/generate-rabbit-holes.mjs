// Edit profile/rabbit-holes.json; run npm run profile:rabbit-holes. No install/network needed.
// The 960×220 log supports three records, with one full-size note line per record.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const escapeXml = value => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
})[c]);
const text = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() ||
      /[\u0000-\u001f\u007f-\u009f\uFFFE\uFFFF\p{Cs}]/u.test(value) ||
      [...value.toUpperCase()].length > max) {
    throw new Error(`${field}: use 1–${max} characters on one line, without outer spaces or invalid XML characters. Shorten the copy rather than reducing type.`);
  }
  return value;
};

try {
  if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: npm run profile:rabbit-holes [-- --check]');
  const check = process.argv.includes('--check');
  const data = JSON.parse(await readFile(new URL('profile/rabbit-holes.json', root), 'utf8'));
  if (!Array.isArray(data.entries) || data.entries.length !== 3) throw new Error('entries: this compact layout needs exactly three records.');
  const entries = data.entries.map((entry, i) => {
    const title = text(entry?.title, `entries[${i}].title`, 48);
    const status = text(entry?.status, `entries[${i}].status`, 7).toUpperCase();
    const note = text(entry?.note, `entries[${i}].note`, 90);
    if (!['OPEN', 'CURIOUS', 'QUEUED'].includes(status)) throw new Error(`entries[${i}].status: choose OPEN, CURIOUS or QUEUED.`);
    return { title, status, note };
  });
  if (entries.filter(entry => entry.status === 'OPEN').length > 1) throw new Error('entries: only one OPEN record is supported, so only one red marker is active.');
  const content = {
    description: 'A curiosity backlog of questions to explore, not claims of expertise. ' + entries.map((entry, i) => `${String(i + 1).padStart(2, '0')}. ${entry.title} — ${entry.status}: ${entry.note}.`).join(' ')
  };
  entries.forEach((entry, i) => {
    content[`title${i}`] = entry.title.toUpperCase();
    content[`status${i}`] = entry.status;
    content[`note${i}`] = entry.note;
    content[`marker${i}`] = entry.status === 'OPEN' ? '1' : '0';
  });
  const template = await readFile(new URL('scripts/rabbit-holes.svg.template', root), 'utf8');
  // Exact existing profile palette; keep Phase 1/garage files and generation unchanged.
  const themes = {
    light: { background: '#F3EDE2', ink: '#161616', muted: '#6F6256', accent: '#C7351D', rule: '#D7C8B3' },
    dark: { background: '#0D1117', ink: '#F3EDE2', muted: '#8B949E', accent: '#C7351D', rule: '#30363D' }
  };
  const outputs = Object.entries(themes).map(([theme, palette]) => {
    const values = { ...content, ...palette };
    const svg = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in values)) throw new Error(`Unknown template placeholder: ${key}`);
      return escapeXml(values[key]);
    });
    return [new URL(`assets/rabbit-holes-${theme}.svg`, root), svg];
  });
  // Both variants are rendered successfully before either can be written.
  for (const [path, svg] of outputs) {
    if (check) {
      if (await readFile(path, 'utf8') !== svg) throw new Error(`${path.pathname}: out of date; run npm run profile:rabbit-holes.`);
    } else await writeFile(path, svg);
  }
  console.log(check ? 'Rabbit-hole assets are current.' : 'Generated both rabbit-hole SVGs.');
} catch (error) {
  console.error(`Rabbit holes: ${error.message}`);
  process.exitCode = 1;
}
