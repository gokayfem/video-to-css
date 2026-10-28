// Minimal static file server bound to 127.0.0.1 so scene stylesheets are
// same-origin (CSSOM readable) in every engine. Serves files under `root` only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.mp4': 'video/mp4', '.js': 'text/javascript', '.mjs': 'text/javascript' };

export async function startServer(root) {
  root = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      const p = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (p !== root && !p.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    url: (absPath) => base + '/' + resolve(absPath).slice(root.length + 1).split(sep).map(encodeURIComponent).join('/'),
    pathOf: (url) => resolve(root, '.' + decodeURIComponent(new URL(url).pathname)),
    close: () => new Promise((r) => server.close(r)),
  };
}
