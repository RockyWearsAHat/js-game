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
// Create HTTP server
const server = http.createServer((req, res) => {
    // This is the static file serving logic
    let filePath = req.url === '/' ? '/index.html' : (req.url || '');
    filePath = filePath.split('?')[0]; // Remove query parameters
    // Correctly resolve the path to the 'dist' directory from 'dist/server'
    const fullPath = path.join(__dirname, '..', filePath);
    const extname = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        // Add other mime types as needed
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    fs.readFile(fullPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // If the file is not found, it might be a client-side route.
                // Serve index.html as a fallback.
                fs.readFile(path.join(__dirname, '..', 'index.html'), (err, indexContent) => {
                    if (err) {
                        res.writeHead(404);
                        res.end('File not found and index.html not found.');
                    }
                    else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(indexContent);
                    }
                });
            }
            else {
                res.writeHead(500);
                res.end('Server Error');
            }
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});
// Initialize WebSocket server on the HTTP server
const wss = new ws_1.WebSocketServer({ server });
console.log('[game-server] starting...');
wss.on('connection', ws => {
    const id = (0, crypto_1.randomUUID)();
    const p = {
        id, ws,
        // random spawn inside 10 × 10 square
        pos: { x: (Math.random() - 0.5) * 10, y: 0, z: (Math.random() - 0.5) * 10 },
        vel: { x: 0, y: 0, z: 0 },
        health: 100,
        yaw: 0,
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
            console.log(`Received message from ${id}:`, data);
            if (data.type === 'input')
                p.input = data.payload;
            if (data.type === 'playerState') {
                p.pos = data.payload.position;
                p.yaw = data.payload.yaw;
            }
        }
        catch { /* ignore malformed */ }
    });
    ws.on('close', () => players.delete(id));
});
setInterval(() => {
    // 1. integrate player movement (now handled client-side)
    /*
    for (const p of players.values()) {
        const dir: Vec3 = { x: 0, y: 0, z: 0 };
        if (p.input.forward) dir.z -= 1;
        if (p.input.back) dir.z += 1;
        if (p.input.left) dir.x -= 1;
        if (p.input.right) dir.x += 1;
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
    */
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
            id: p.id, pos: p.pos, health: p.health, yaw: p.yaw
        })),
        bullets: bullets.map(b => ({ pos: b.pos }))
    };
    const payload = JSON.stringify(snapshot);
    // console.log('Broadcasting world state:', payload); 
    for (const p of players.values()) {
        if (p.ws.readyState === ws_1.WebSocket.OPEN) {
            p.ws.send(payload);
        }
    }
}, TICK);
// If SERVE_STATIC env variable is set, serve static files
if (process.env.SERVE_STATIC === 'true' || process.argv.includes('--serve-static')) {
    console.log('Serving static files from client directory');
    // The static file serving is now integrated into the http.createServer callback
}
// Start the server
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(Number(PORT), HOST, () => {
    const address = server.address();
    if (typeof address === 'string') {
        console.log(`Game server running at ${address}`);
    }
    else if (address) {
        console.log(`Game server running at http://${address.address}:${address.port}`);
    }
    console.log(`WebSocket server available at ws://${HOST}:${PORT}`);
});
