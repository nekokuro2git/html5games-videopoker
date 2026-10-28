import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cardInfo } from '../src/engine.mjs';
const manifest = JSON.parse(await fs.readFile('public/assets/manifest.json', 'utf8'));
let checked = 0;
for (const record of manifest.assets) {
  for (const directory of ['public/assets', 'dist/client/assets']) {
    const bytes = await fs.readFile(`${directory}/${record.file}`);
    if (createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error(`Asset hash mismatch: ${directory}/${record.file}`);
    checked++;
  }
}
for (let i = 0; i < 54; i++) await fs.access(`dist/client/assets/deck/${cardInfo(i).image}.png`);
const html = await fs.readFile('dist/client/index.html', 'utf8');
if (!html.includes('lang="en"')) throw new Error('Default language is not English');
if (!html.includes('noindex,nofollow')) throw new Error('Fun-play build should be noindex');
if (/src="https?:|href="https?:/i.test(html)) throw new Error('External application dependency');
await fs.mkdir('qa', { recursive: true });
const result = { at: new Date().toISOString(), status: 'passed', assets: manifest.assets.length, hashChecks: checked, cards: 54, language: 'en' };
await fs.writeFile('qa/asset-verification.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
