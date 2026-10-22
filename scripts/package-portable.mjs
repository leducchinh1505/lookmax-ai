// Builds release/Lookmax-AI-portable.zip: the production build plus a
// PowerShell static server, so friends can run it without installing Node.js.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, 'release', 'Lookmax-AI');
const zip = join(root, 'release', 'Lookmax-AI-portable.zip');

if (!existsSync(join(root, 'dist', 'index.html')) || !existsSync(join(root, 'dist', 'models', 'face_landmarker.task'))) {
  console.error('dist/ is missing or incomplete. Run `npm run setup:assets` and `npm run build` first.');
  process.exit(1);
}

rmSync(join(root, 'release'), { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(root, 'dist'), join(stage, 'app'), { recursive: true });
for (const f of ['server.ps1', 'Mo-Lookmax-AI.bat', 'HUONG-DAN.txt']) cpSync(join(root, 'scripts', 'portable', f), join(stage, f));

execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${stage}' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });
console.log('✔ Created', zip);
