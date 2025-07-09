"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const crypto_1 = require("crypto");
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const TICK = 50; // 20 FPS server tick
const SPEED = 0.12;
const BULLET_SPEED = 0.6;
const BULLET_LIFE = 2000; // ms
const RADIUS = 0.5;
const BULLET_RADIUS = 0.2;
const players = new Map();
const bullets = [];
// Add this function to serve static files
function serveStaticFiles(server) {
    const MIME_TYPES = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };
    server.on('request', (req, res) => {
        // Get the file path
        let filePath = req.url === '/' ? '/index.html' : req.url;
        if (!filePath)
            filePath = '/index.html';
        // Remove query parameters
        filePath = filePath.split('?')[0];
        // Get the full path
        const fullPath = path.join(process.cwd(), '../', filePath);
        // Get the file extension
        const extname = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extname] || 'application/octet-stream';
        // Read the file
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                // If file not found, try serving index.html (for SPAs)
                if (err.code === 'ENOENT') {
                    fs.readFile(path.join(process.cwd(), '../', 'index.html'), (err, data) => {
                        if (err) {
                            res.writeHead(404);
                            res.end('File not found');
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(data);
                    });
                    return;
                }
                res.writeHead(500);
                res.end('Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
}
// Create HTTP server
const server = http.createServer();
// Initialize WebSocket server on the HTTP server
const wss = new ws_1.WebSocketServer({ server });
console.log('[game-server] listening on ws://localhost:8080');
wss.on('connection', ws => {
    const id = (0, crypto_1.randomUUID)();
    const p = {
        id, ws,
        // random spawn inside 10 × 10 square
        pos: { x: (Math.random() - 0.5) * 10, y: 0, z: (Math.random() - 0.5) * 10 },
        vel: { x: 0, y: 0, z: 0 },
        health: 100,
        input: {
            forward: false, back: false, left: false, right: false,
            shoot: false,
            dir: { x: 0, y: 0, z: 1 }
        }
    };
    players.set(id, p);
    ws.send(JSON.stringify({ type: 'welcome', id }));
    ws.on('message', raw => {
        try {
            const data = JSON.parse(raw.toString());
            if (data.type === 'input')
                p.input = data.payload;
        }
        catch { /* ignore malformed */ }
    });
    ws.on('close', () => players.delete(id));
});
setInterval(() => {
    // 1. integrate player movement
    for (const p of players.values()) {
        const dir = { x: 0, y: 0, z: 0 };
        if (p.input.forward)
            dir.z -= 1;
        if (p.input.back)
            dir.z += 1;
        if (p.input.left)
            dir.x -= 1;
        if (p.input.right)
            dir.x += 1;
        // simple normalisation
        const len = Math.hypot(dir.x, dir.z) || 1;
        p.vel.x = (dir.x / len) * SPEED;
        p.vel.z = (dir.z / len) * SPEED;
        p.pos.x += p.vel.x;
        p.pos.z += p.vel.z;
        // shooting
        if (p.input.shoot) {
            bullets.push({
                owner: p.id,
                pos: { ...p.pos },
                dir: { ...p.input.dir },
                life: BULLET_LIFE
            });
            // one bullet per tick-press
            p.input.shoot = false;
        }
    }
    // 2. integrate bullets
    for (let i = bullets.length - 1; i >= 0; --i) {
        const b = bullets[i];
        b.pos.x += b.dir.x * BULLET_SPEED;
        b.pos.y += b.dir.y * BULLET_SPEED;
        b.pos.z += b.dir.z * BULLET_SPEED;
        b.life -= TICK;
        if (b.life <= 0)
            bullets.splice(i, 1);
    }
    // 3. collisions: bullet ↔ player
    for (let i = bullets.length - 1; i >= 0; --i) {
        const b = bullets[i];
        for (const p of players.values()) {
            if (p.id === b.owner)
                continue;
            const d = Math.hypot(p.pos.x - b.pos.x, p.pos.y - b.pos.y, p.pos.z - b.pos.z);
            if (d < RADIUS + BULLET_RADIUS) {
                p.health -= 20;
                bullets.splice(i, 1);
                break;
            }
        }
    }
    // 4. broadcast world
    const snapshot = {
        type: 'world',
        players: [...players.values()].map(p => ({
            id: p.id, pos: p.pos, health: p.health
        })),
        bullets: bullets.map(b => ({ pos: b.pos }))
    };
    const payload = JSON.stringify(snapshot);
    for (const p of players.values()) {
        if (p.ws.readyState === ws_1.WebSocket.OPEN) {
            p.ws.send(payload);
        }
    }
}, TICK);
// If SERVE_STATIC env variable is set, serve static files
if (process.env.SERVE_STATIC === 'true' || process.argv.includes('--serve-static')) {
    console.log('Serving static files from client directory');
    serveStaticFiles(server);
}
// Start the server
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(Number(PORT), () => {
    console.log(`Game server running at http://${HOST}:${PORT}`);
    console.log(`WebSocket server available at ws://${HOST}:${PORT}`);
});
//# sourceMappingURL=game-server.js.map