import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

export function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

export function sha256Dir(dir) {
  // Deterministic checksum over every file in a directory (sorted relative paths + contents).
  const h = createHash('sha256');
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(relative(dir, p)).update('\0').update(readFileSync(p)).update('\0');
    }
  };
  walk(dir);
  return h.digest('hex');
}

export function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    execFile(cmd, args, { maxBuffer: 1 << 30, encoding: opts.encoding ?? 'utf8', ...opts }, (err, stdout, stderr) => {
      if (err) rej(new Error(`${cmd} ${args.join(' ')}\n${stderr}`));
      else res(stdout);
    });
  });
}

export const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
export function writeJSON(p, v) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
}
export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
  return p;
}

// Walk up from a directory to find the repository/project root (has package.json or .git).
export function findRoot(start = process.cwd()) {
  let d = resolve(start);
  for (;;) {
    if (existsSync(join(d, '.git')) || existsSync(join(d, 'package.json'))) return d;
    const up = dirname(d);
    if (up === d) return resolve(start);
    d = up;
  }
}

// Load a scene package: <dir>/scene.json + <dir>/scene/. reference.clip may be absolute,
// relative to the scene directory, or relative to the project root (checked in that order).
export function loadScene(sceneDir) {
  const dir = resolve(sceneDir);
  const scene = readJSON(join(dir, 'scene.json'));
  const root = findRoot(dir);
  const clip = scene.reference?.clip;
  const clipPath = !clip ? null : [resolve(dir, clip), resolve(root, clip)].find((p) => existsSync(p)) ?? resolve(dir, clip);
  return {
    ...scene,
    dir,
    root,
    htmlPath: join(dir, 'scene', 'index.html'),
    cssPath: join(dir, 'scene', 'scene.css'),
    clipPath,
    artifacts: join(root, 'artifacts', scene.id),
  };
}

export const fmt = (v, d = 3) => (typeof v === 'number' && Number.isFinite(v) ? +v.toFixed(d) : v);
export const pad = (i, n = 4) => String(i).padStart(n, '0');
