import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const htmlPath = resolve(scriptDir, '..', 'index.html');
const html = await readFile(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

if (scripts.length === 0) {
  throw new Error('No <script> blocks found in index.html');
}

const javascriptTypes = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript'
]);

let checked = 0;

for (const [index, match] of scripts.entries()) {
  const attributes = match[1];
  if (/\bsrc\s*=/i.test(attributes)) continue;

  const typeMatch = attributes.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  const type = (typeMatch ? (typeMatch[1] ?? typeMatch[2] ?? typeMatch[3]) : '')
    .trim()
    .toLowerCase();

  if (!javascriptTypes.has(type)) continue;

  new vm.Script(match[2], { filename: `index.html:inline-script-${index + 1}.js` });
  checked++;
}

if (checked === 0) {
  throw new Error('No inline JavaScript blocks found in index.html');
}

console.log(`Checked ${checked} inline JavaScript block(s).`);
