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
exports.ServerGame = void 0;
const THREE = __importStar(require("three"));
const ws_1 = require("ws");
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const server_character_controller_1 = require("./server-character-controller");
const server_world_builder_1 = require("./server-world-builder");
const server_weapon_system_1 = require("./server-weapon-system");
const config_1 = require("../core/config");
const os = __importStar(require("os"));
const server_config_1 = require("./server-config");
// --- helper -------------------------------------------------
const v3 = (v) => ({ x: v.x, y: v.y, z: v.z });
/**
 * Server-side Game class
 *
 * Manages the game loop and coordinates all game systems for a dedicated server.
 * No rendering or direct user input handling.
 */
class ServerGame {
    /**
     * Create a new server game instance
     */
    constructor(port) {
        // Game objects
        this.objects = [];
        this.lastTime = 0;
        this.isGameRunning = false;
        this.nextPlayerId = 0;
        this.spawnPoints = [
            new THREE.Vector3(-20, 1.5, 0),
            new THREE.Vector3(20, 1.5, 0),
            new THREE.Vector3(0, 1.5, -20),
            new THREE.Vector3(0, 1.5, 20),
        ];
        this.currentSpawnPointIndex = 0;
        /**
         * The main game loop
         */
        this.update = () => {
            if (!this.isGameRunning)
                return;
            const currentTime = this.clock.getElapsedTime();
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            // Update all players
            this.players.forEach((playerState, playerId) => {
                playerState.characterController.update(deltaTime, this.objects, playerState.input, playerState.input.jump);
                // Handle firing
                if (playerState.input.fire) {
                    const weaponConfig = config_1.WEAPON_CONFIGS[playerState.currentWeapon];
                    const timeSinceLastFire = Date.now() - playerState.lastFireTime;
                    if (timeSinceLastFire > 1000 / (weaponConfig.fireRate / 60)) {
                        playerState.lastFireTime = Date.now();
                        // Calculate firing direction from quaternion
                        const fireDirection = new THREE.Vector3(0, 0, -1);
                        fireDirection.applyQuaternion(playerState.characterController.quaternion);
                        this.serverWeaponSystem.fire(playerState.characterController.position, fireDirection, playerState.currentWeapon, playerId);
                    }
                }
            });
            // Broadcast game state to all clients
            this.broadcastGameState();
            // Schedule the next update
            setTimeout(this.update, 1000 / 60); // 60 FPS
        };
        this.clock = new THREE.Clock();
        this.players = new Map();
        // Create HTTP server to serve static files and handle WebSockets
        this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));
        // Set up world builder
        this.worldBuilder = new server_world_builder_1.ServerWorldBuilder(new THREE.Scene());
        // Build the world
        this.buildWorld();
        // Set up server weapon system
        this.serverWeaponSystem = new server_weapon_system_1.ServerWeaponSystem(this.objects);
        // Set up WebSocket server and attach it to the HTTP server
        this.wss = new ws_1.WebSocketServer({ server: this.httpServer });
        this.httpServer.listen(port, "0.0.0.0", () => {
            console.log(`Server started. Listening for HTTP and WebSocket connections on port ${port}`);
        });
        this.wss.on('connection', (ws) => {
            const playerId = `player_${this.nextPlayerId++}`;
            console.log(`Client connected: ${playerId}`);
            // Create a new character controller for the connected player
            const newPlayerController = new server_character_controller_1.ServerCharacterController();
            const spawnPoint = this.spawnPoints[this.currentSpawnPointIndex];
            newPlayerController.position.copy(spawnPoint);
            this.currentSpawnPointIndex = (this.currentSpawnPointIndex + 1) % this.spawnPoints.length;
            this.players.set(playerId, {
                id: playerId,
                characterController: newPlayerController,
                input: {
                    moveForward: false,
                    moveBackward: false,
                    moveLeft: false,
                    moveRight: false,
                    jump: false,
                    sprint: false,
                    crouch: false,
                    fire: false,
                    reload: false,
                    aim: false,
                },
                // Add other player-specific data here, e.g., weapon state
                currentWeapon: config_1.WeaponType.PISTOL,
                lastFireTime: 0,
            });
            // Send initial state to the new player
            ws.send(JSON.stringify({
                type: 'init',
                playerId,
                initialPosition: v3(newPlayerController.position),
                players: Array.from(this.players.values()).map(p => ({
                    id: p.id,
                    position: v3(p.characterController.position),
                    quaternion: p.characterController.quaternion.toArray(),
                    isCrouching: p.characterController.isCrouching,
                    currentWeapon: p.currentWeapon,
                })),
                worldState: this.getWorldState(),
            }));
            // Broadcast new player to all other clients
            this.broadcastToAllExcept(playerId, JSON.stringify({
                type: 'player_connect',
                playerId,
                initialPosition: v3(newPlayerController.position),
                currentWeapon: config_1.WeaponType.PISTOL,
            }));
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    const playerState = this.players.get(playerId);
                    if (playerState) {
                        if (data.type === 'input') {
                            playerState.input = data.input;
                            // Update character quaternion
                            if (data.quaternion) {
                                playerState.characterController.quaternion.fromArray(data.quaternion);
                            }
                        }
                        else if (data.type === 'weapon_switch') {
                            const newWeapon = data.weapon;
                            if (config_1.WEAPON_CONFIGS[newWeapon]) {
                                playerState.currentWeapon = newWeapon;
                                this.broadcastToAll(JSON.stringify({
                                    type: 'weapon_switch',
                                    playerId,
                                    weapon: newWeapon,
                                }));
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Error processing message from ${playerId}:`, error);
                }
            });
            ws.on('close', () => {
                console.log(`Client disconnected: ${playerId}`);
                this.players.delete(playerId);
                this.broadcastToAll(JSON.stringify({ type: 'player_disconnect', playerId }));
            });
            ws.on('error', (error) => {
                console.error(`WebSocket error from ${playerId}:`, error);
            });
        });
        this.httpServer.on('error', (error) => {
            console.error('HTTP Server Error:', error);
            // For EADDRINUSE, provide a clearer message
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use. Please ensure no other process is using this port.`);
            }
        });
    }
    /**
     * Handle incoming HTTP requests to serve static files
     */
    handleHttpRequest(req, res) {
        // Path to the distribution folder where client assets are located
        // server-game.js is in dist/server/server, client files are in dist/
        const publicDir = path.resolve(__dirname, '..', '..');
        let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url);
        // Security: prevent directory traversal
        if (!filePath.startsWith(publicDir)) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }
        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
        };
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code == 'ENOENT') {
                    // If the file is not found, it's likely a SPA route. Serve index.html.
                    fs.readFile(path.join(publicDir, 'index.html'), (err, content) => {
                        if (err) {
                            res.writeHead(500);
                            res.end(`Server Error: ${err.code}`);
                        }
                        else {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(content, 'utf-8');
                        }
                    });
                }
                else {
                    res.writeHead(500);
                    res.end(`Server Error: ${error.code}`);
                }
            }
            else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
    /**
     * Build the game world
     */
    buildWorld() {
        this.worldBuilder.build();
        this.objects.push(...this.worldBuilder.getCollisionObjects());
    }
    /**
     * Start the server game loop
     */
    start() {
        if (this.isGameRunning)
            return;
        this.isGameRunning = true;
        this.lastTime = this.clock.getElapsedTime();
        console.log('Server game loop started.');
        this.update();
    }
    /**
     * Stop the server game loop
     */
    stop() {
        this.isGameRunning = false;
        console.log('Server game loop stopped.');
    }
    /**
     * Broadcast game state to all connected clients
     */
    broadcastGameState() {
        const gameState = {
            type: 'game_state',
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                position: v3(p.characterController.position),
                quaternion: p.characterController.quaternion.toArray(),
                isCrouching: p.characterController.isCrouching,
                velocity: v3(p.characterController.velocity),
            })),
            // Add other relevant game state here, e.g., projectiles
        };
        this.broadcastToAll(JSON.stringify(gameState));
    }
    /**
     * Get the current state of the world (static objects)
     */
    getWorldState() {
        // This can be expanded to include dynamic objects, etc.
        return {
            collisionObjects: this.objects.map(obj => ({
                position: v3(obj.position),
                quaternion: obj.quaternion.toArray(),
                // You might need to send geometry/material info as well
            })),
        };
    }
    /**
     * Broadcast a message to all connected clients
     */
    broadcastToAll(message) {
        this.wss.clients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    /**
     * Broadcast a message to all clients except one
     */
    broadcastToAllExcept(exceptPlayerId, message) {
        this.wss.clients.forEach(client => {
            // Make sure to associate playerId with the ws connection
            // This is a simplified check; you'd implement this association on connection.
            const playerSocket = client;
            if (playerSocket.playerId !== exceptPlayerId && client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}
exports.ServerGame = ServerGame;
// --- auto-start standalone server ------------------------------------------
// This allows the server to be started directly with `ts-node` or `node`
// for development or as a dedicated server.
if (require.main === module) {
    const port = parseInt(process.env.PORT || '8080', 10);
    console.log(`[ServerGame] Bootstrapping on http://localhost:${port}`);
    const server = new ServerGame(port);
    server.start();
}
// In a server environment, you can't access window.location.hostname
// Instead, use one of these approaches:
// 1. Use the os module to get network interfaces
function getServerAddress() {
    // Get all network interfaces
    const networkInterfaces = os.networkInterfaces();
    let serverIp = '0.0.0.0'; // Default fallback - listen on all interfaces
    // Try to find a suitable IP address (non-internal, IPv4)
    Object.keys(networkInterfaces).forEach(interfaceName => {
        const interfaces = networkInterfaces[interfaceName];
        if (interfaces) {
            interfaces.forEach(iface => {
                // Skip internal and non-IPv4 addresses
                if (!iface.internal && iface.family === 'IPv4') {
                    serverIp = iface.address;
                }
            });
        }
    });
    return serverIp;
}
// 2. Use environment variables (recommended for production)
const HOST = process.env.HOST || getServerAddress();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
// Setup WebSocket server
const wss = new ws_1.WebSocketServer({
    host: HOST,
    port: PORT,
    // Add ping/pong for connection stability
    clientTracking: true
});
console.log(`Game server started on ws://${HOST}:${PORT}`);
// Add heartbeat mechanism to detect dead connections
const interval = setInterval(() => {
    wss.clients.forEach(ws => {
        // @ts-ignore: add _isAlive property to track connection health
        if (ws._isAlive === false)
            return ws.terminate();
        // @ts-ignore
        ws._isAlive = false;
        ws.ping();
    });
}, server_config_1.ServerConfig.pingInterval);
wss.on('connection', (ws) => {
    // @ts-ignore
    ws._isAlive = true;
    ws.on('pong', () => {
        // @ts-ignore
        ws._isAlive = true;
    });
    // ...existing connection handling code...
});
wss.on('close', () => {
    clearInterval(interval);
});
// ...existing code...
