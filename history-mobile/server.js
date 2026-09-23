const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3000);
const root = __dirname;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(root, pathname.replace(/^\/+/, ''));
  if (!filePath.startsWith(root)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    const target = (!err && stat.isFile()) ? filePath : path.join(root, 'index.html');
    fs.readFile(target, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
        return res.end('Not found');
      }
      res.writeHead(200, {'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream'});
      res.end(data);
    });
  });
}).listen(port, '0.0.0.0', () => {
  console.log('SUMUS HISTORY listening on port ' + port);
});