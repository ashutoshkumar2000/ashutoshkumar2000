// No install or network access needed. Content: ../garage.json; layout: ./garage.svg.template.
// The approved layout has four modes, three bench rows and three offline labels.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const escapeXml = value => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
})[c]);
const upper = value => value.toUpperCase();
const sentence = value => value[0].toUpperCase() + value.slice(1).toLowerCase();
const lowerFirst = value => value[0].toLowerCase() + value.slice(1);
const text = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(value) || [...upper(value)].length > max) {
    throw new Error(`${field}: use 1–${max} characters, without outer spaces or control characters.`);
  }
  return value;
};
const list = (value, field, count) => {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error(`${field}: the approved layout needs exactly ${count} entries.`);
  }
  return value;
};
const wrapDescription = value => {
  const lines = [''];
  for (const word of value.split(/\s+/u)) {
    if ([...word].length > 22) throw new Error('current_build.description: each word must fit within 22 characters.');
    const last = lines.length - 1;
    const next = lines[last] ? `${lines[last]} ${word}` : word;
    if ([...next].length <= 22) lines[last] = next;
    else lines.push(word);
  }
  if (lines.length > 2) throw new Error('current_build.description: shorten it to fit two lines of 22 characters.');
  return [lines[0], lines[1] ?? ''];
};

try {
  if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: npm run profile [-- --check]');
  const check = process.argv.includes('--check');
  const data = JSON.parse(await readFile(new URL('garage.json', root), 'utf8'));
  const name = text(data.current_build?.name, 'current_build.name', 13);
  const description = text(data.current_build?.description, 'current_build.description', 45);
  const status = text(data.current_build?.status, 'current_build.status', 18);
  const modes = list(data.ride_modes, 'ride_modes', 4).map((mode, i) => upper(text(mode, `ride_modes[${i}]`, 7)));
  if (new Set(modes).size !== modes.length) throw new Error('ride_modes: entries must be unique.');
  const mode = upper(text(data.ride_mode, 'ride_mode', 7));
  if (!modes.includes(mode)) throw new Error('ride_mode: choose one of ride_modes.');
  const inactive = modes.filter(value => value !== mode);
  const bench = list(data.on_the_bench, 'on_the_bench', 3).map((item, i) => ({
    name: text(item?.name, `on_the_bench[${i}].name`, 12),
    status: text(item?.status, `on_the_bench[${i}].status`, 18)
  }));
  const rabbitTitle = text(data.rabbit_hole?.title, 'rabbit_hole.title', 46);
  const topics = data.rabbit_hole?.topics;
  if (!Array.isArray(topics) || !topics.length) throw new Error('rabbit_hole.topics: supply at least one topic.');
  topics.forEach((topic, i) => text(topic, `rabbit_hole.topics[${i}]`, 68));
  text(topics.join(' / '), 'rabbit_hole.topics (combined)', 68);
  const offline = list(data.offline_mode, 'offline_mode', 3).map((item, i) => text(item, `offline_mode[${i}]`, 38));
  text(offline.slice(0, 2).join(' / '), 'offline_mode (first two combined)', 32);
  const lines = wrapDescription(description);
  const summary = `Motorcycle-inspired engineering workbench. Ride mode: ${sentence(mode)}; other modes: ${inactive.map(sentence).join(', ')}. Current build: ${name}, a ${lowerFirst(description)}, ${status.toLowerCase()}. On the bench: ${bench.map(item => `${item.name} ${item.status === '?' ? 'unknown' : item.status.toLowerCase()}`).join(', ')}. Current rabbit hole: ${lowerFirst(rabbitTitle)} — ${topics.join(', ')}. Offline mode: ${offline.join(', ')}.`;
  const content = {
    description: summary,
    rideMode: mode,
    rideModeSize: String(Math.min(29, Math.floor((100 - (mode.length - 1)) / (mode.length * .65)))),
    inactive0: inactive[0], inactive1: inactive[1], inactive2: inactive[2],
    buildName: upper(name), buildLine0: lines[0], buildLine1: lines[1], buildStatus: upper(status),
    rabbitTitle: upper(rabbitTitle), rabbitTopics: upper(topics.join(' / ')),
    offlineLine0: upper(offline.slice(0, 2).join(' / ')), offlineLine1: upper(offline[2])
  };
  bench.forEach((item, i) => { content[`bench${i}Name`] = upper(item.name); content[`bench${i}Status`] = upper(item.status); });
  const template = await readFile(new URL('scripts/garage.svg.template', root), 'utf8');
  const themes = {
    light: { background: '#F3EDE2', ink: '#161616', muted: '#6F6256', accent: '#C7351D', rule: '#D7C8B3' },
    dark: { background: '#0D1117', ink: '#F3EDE2', muted: '#8B949E', accent: '#C7351D', rule: '#30363D' }
  };
  // Render and validate both variants before writing either file.
  const outputs = Object.entries(themes).map(([theme, palette]) => {
    const values = { ...content, ...palette };
    const svg = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in values)) throw new Error(`Unknown template placeholder: ${key}`);
      return escapeXml(values[key]);
    });
    return [new URL(`assets/garage-${theme}.svg`, root), svg];
  });
  for (const [path, svg] of outputs) {
    if (check) {
      if (await readFile(path, 'utf8') !== svg) throw new Error(`${path.pathname}: out of date; run npm run profile.`);
    } else await writeFile(path, svg);
  }
  console.log(check ? 'Garage assets are current.' : 'Generated both garage SVGs.');
} catch (error) {
  console.error(`Garage: ${error.message}`);
  process.exitCode = 1;
}
