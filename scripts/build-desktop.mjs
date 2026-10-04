// Builds the Windows desktop app into desktop/dist/Fidelis:
//   node scripts/build-desktop.mjs            (build only)
//   node scripts/build-desktop.mjs --install  (build, install for this user and start it)
//   add --no-start to install without opening it now (it still starts with Windows)
// The window shows the same web build as the browser version (see desktop/).
import { execFileSync, execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const out = join(root, 'desktop', 'dist', 'Fidelis');
const install = process.argv.includes('--install');
const start = !process.argv.includes('--no-start');

function dotnet() {
  // Prefer a per-user SDK (installed without admin), then whatever is on the PATH.
  const local = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'dotnet', 'dotnet.exe');
  return existsSync(local) ? local : 'dotnet';
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

execSync('npm run build:web', { cwd: root, stdio: 'inherit' });

rmSync(out, { recursive: true, force: true });
run(dotnet(), ['publish', join('desktop', 'Fidelis.Desktop.csproj'), '-c', 'Release', '-o', out, '-nologo']);

// The web build lives under its base URL (experiments.baseUrl), e.g. wwwroot/fidelis/.
const baseUrl = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo.experiments?.baseUrl ?? '';
const webRoot = join(out, 'wwwroot', ...baseUrl.split('/').filter(Boolean));
mkdirSync(webRoot, { recursive: true });
cpSync(join(root, 'dist'), webRoot, { recursive: true });
console.log(`Desktop app ready in ${out}`);

if (install) {
  const target = join(process.env.LOCALAPPDATA, 'Programs', 'Fidelis');
  const exe = join(target, 'Fidelis.exe');
  // Close a running copy so its files can be replaced (matched by path: other programs may
  // also be called Fidelis.exe).
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Get-Process Fidelis -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '${exe}' } | Stop-Process -Force; exit 0`,
  ]);
  rmSync(target, { recursive: true, force: true });
  cpSync(out, target, { recursive: true });
  const shortcut = join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Fidelis.lnk');
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${shortcut}'); $s.TargetPath = '${exe}'; $s.WorkingDirectory = '${target}'; $s.Description = 'Fidelis'; $s.Save()`,
  ]);
  // Start with Windows (the app does this itself on first launch; doing it here too means it
  // works even if it isn't opened before the next restart). Ajustes can turn it off.
  const runKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  execFileSync('reg', ['add', runKey, '/v', 'Fidelis', '/t', 'REG_SZ', '/d', `"${exe}" --autostart`, '/f'], {
    stdio: 'ignore',
  });
  if (start) spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
  console.log(`Installed in ${target} (Start menu: Fidelis)`);
}
