import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(scriptDir, '..');
const cssPath = resolve(root, '.tailwind.generated.css');
const htmlPath = resolve(root, 'index.html');

const css = await readFile(cssPath, 'utf8');
const html = await readFile(htmlPath, 'utf8');
const stylePattern = /<style id="tailwind-bundle">[\s\S]*?<\/style>/;

if (!stylePattern.test(html)) {
  throw new Error('Could not find <style id="tailwind-bundle"> in index.html');
}

const next = html.replace(
  stylePattern,
  `<style id="tailwind-bundle">\n${css.trim()}\n  </style>`
);

await writeFile(htmlPath, next, 'utf8');
console.log(`Injected ${css.length.toLocaleString()} bytes of generated Tailwind CSS into index.html.`);
