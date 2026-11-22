import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pmtiles': 'application/vnd.pmtiles',
  '.pbf': 'application/x-protobuf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Accept-Ranges', 'bytes');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse path
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(reqUrl.pathname);

  if (pathname === '/') pathname = '/index.html';
  // Mirror the published layout: /glyphs and /sprites live next to the style
  pathname = pathname.replace(/^\/glyphs\//, '/glyphs/dist/').replace(/^\/sprites\//, '/styles/sprites/');

  // Repo root (styles, dist/ethiopia.pmtiles, tools) first, then the built React example
  const candidateDirs = [ROOT_DIR, path.join(ROOT_DIR, 'examples/web-react/dist')];
  const extensions = [''];

  let filePath = null;

  for (const dir of candidateDirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir, pathname + ext);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        filePath = candidate;
        break;
      }
    }
    if (filePath) break;
  }

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${pathname}`);
    return;
  }

  // Security check: prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      // Parse Range header (e.g., "bytes=0-1023")
      const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (!matches) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        res.end();
        return;
      }

      let start = matches[1] ? parseInt(matches[1], 10) : 0;
      let end = matches[2] ? parseInt(matches[2], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        res.end();
        return;
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': contentType
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  Ethiopian Maps SDK — React Development Server        `);
  console.log(`  Native HTTP 206 Range Requests + CORS Enabled        `);
  console.log(`======================================================`);
  console.log(`  React App:     http://localhost:${PORT}/`);
  console.log(`  Diagnostic UI: http://localhost:${PORT}/tools/check-pmtiles/index.html`);
  console.log(`  Root Folder:   ${ROOT_DIR}`);
  console.log(`======================================================\n`);
});
