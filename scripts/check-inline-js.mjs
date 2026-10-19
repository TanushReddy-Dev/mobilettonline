import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const htmlPath = resolve(scriptDir, '..', 'index.html');
const html = await readFile(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];

if (scripts.length === 0) {
  throw new Error('No inline <script> blocks found in index.html');
}

for (const [index, match] of scripts.entries()) {
  new vm.Script(match[1], { filename: `index.html:inline-script-${index + 1}.js` });
}

console.log(`Checked ${scripts.length} inline script block(s).`);
