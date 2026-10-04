// Turns the Expo web export into an installable PWA for GitHub Pages:
//   npx expo export --platform web && node scripts/build-web.mjs
// Adds the manifest and iOS tags to index.html, writes a service worker that precaches the
// whole build (so the app opens offline), and adds the files GitHub Pages needs.
import { createHash } from 'node:crypto';
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
// Where the site lives (e.g. /fidelis-android/ on GitHub Pages), from experiments.baseUrl.
const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const BASE = `${appConfig.expo.experiments?.baseUrl ?? ''}/`;

const HEAD_TAGS = `
    <link rel="manifest" href="${BASE}manifest.webmanifest" />
    <meta name="theme-color" content="#0d0d0d" />
    <meta name="description" content="Objetivos diarios, semanales y mensuales con rachas y estadísticas." />
    <link rel="apple-touch-icon" href="${BASE}apple-touch-icon.png" />
    <style>
      html, body { background: #0d0d0d; }
      /* Phone-width column on desktop screens. */
      #root { width: 100%; max-width: 720px; margin: 0 auto; }
      /* Expo Router draws the web tabs as a pill at the top, over the screen titles; put it
         at the bottom like on Android and keep the content clear of it. */
      [class*="navigationMenuRoot"] { top: auto; bottom: calc(12px + env(safe-area-inset-bottom)); max-width: 96vw; }
      [class*="tabContent"] { box-sizing: border-box; min-height: 0; padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
      @media (max-width: 440px) {
        :root { --expo-router-tabs-font-size: 13px; }
        [class*="navigationMenuTrigger"] { padding: 0 9px; }
      }
    </style>
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <meta name="apple-mobile-web-app-title" content="Fidelis" />
    <script>
      if ('serviceWorker' in navigator) {
        addEventListener('load', () => navigator.serviceWorker.register('${BASE}sw.js').catch(console.warn));
      }
    </script>
`;

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const indexPath = join(DIST, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('manifest.webmanifest')) {
  html = html
    .replace(/<html lang="[^"]*"/, '<html lang="es"')
    .replace(/<title>.*?<\/title>/, '<title>Fidelis</title>')
    .replace('shrink-to-fit=no', 'shrink-to-fit=no, viewport-fit=cover')
    .replace('</head>', `${HEAD_TAGS}</head>`);
  writeFileSync(indexPath, html);
}

// Deep links (e.g. /focus) are served the app shell instead of GitHub's 404 page.
copyFileSync(indexPath, join(DIST, '404.html'));
// Without this, Jekyll would drop the _expo folder.
writeFileSync(join(DIST, '.nojekyll'), '');

const skip = new Set(['sw.js', '404.html', '.nojekyll']);
const files = listFiles(DIST)
  .map((path) => relative(DIST, path).split(sep).join('/'))
  .filter((path) => !skip.has(path))
  .sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(readFileSync(join(DIST, file)));
const version = hash.digest('hex').slice(0, 12);

const template = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8');
writeFileSync(
  join(DIST, 'sw.js'),
  template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(['./', ...files], null, 2)),
);
console.log(`PWA ready in ${DIST}: ${files.length} files precached (version ${version})`);
