import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../research/evidence');
await fs.mkdir(root, { recursive: true });
const installation = process.env.REA_INSTALLATION || 'C:/Users/USER/AppData/Roaming/npm/node_modules/rea-agents';
const { Client } = await import(pathToFileURL(path.join(installation, 'node_modules/@modelcontextprotocol/client/dist/index.mjs')).href);
const { StdioClientTransport } = await import(pathToFileURL(path.join(installation, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs')).href);
const client = new Client({ name: 'videopoker-research', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(installation, 'scripts/rea.mjs'), 'mcp'], stderr: 'pipe' }));
const catalog = (await client.listTools()).tools;
await fs.writeFile(path.join(root, 'rea-tool-catalog.json'), JSON.stringify(catalog.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })), null, 2));
function sanitize(value) {
  if (typeof value === 'string') return value.replace(/([?&](?:ssoKey|token|sessionId|authorization|accessToken)=)[^&\s"<>]*/gi, '$1[REDACTED]');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, /^(ssoKey|token|authorization|cookie|accessToken|refreshToken)$/i.test(k) ? '[REDACTED]' : sanitize(v)]));
  return value;
}
const port = 9263;
const server = http.createServer(async (req,res) => {
  if (req.headers.host !== `127.0.0.1:${port}` || req.headers.origin && req.headers.origin !== `http://127.0.0.1:${port}`) { res.writeHead(403); res.end(); return; }
  if (req.method !== 'POST' || req.url !== '/research') { res.writeHead(404); res.end(); return; }
  try {
    let body = ''; for await (const c of req) { body += c; if (Buffer.byteLength(body) > 1024 * 1024) throw new Error('Request exceeds 1 MiB'); }
    const request = JSON.parse(body);
    const result = sanitize(request.schema ? catalog.filter(t => request.schema.includes(t.name)).map(({name,inputSchema})=>({name,inputSchema})) : await client.callTool({ name: request.name, arguments: request.arguments || {} }, undefined, { timeout: request.timeout || 240000 }));
    if (request.save) {
      const target = path.resolve(root, request.save);
      if (!target.startsWith(root + path.sep)) throw new Error('Evidence path escaped research/evidence');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(result, null, 2));
    }
    const serialized = JSON.stringify(result);
    res.setHeader('Content-Type', 'application/json');
    res.end(serialized.length > (request.previewLimit || 12000) ? JSON.stringify({ saved: request.save, preview: serialized.slice(0,request.previewLimit || 12000) }) : serialized);
  } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); }
});
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ ready:true, endpoint:`http://127.0.0.1:${port}/research`, version:client.getServerVersion() })));
process.on('SIGINT', async()=>{server.close();await client.close();process.exit(0);});
