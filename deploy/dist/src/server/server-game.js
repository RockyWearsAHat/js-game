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
        this.clock = new THREE.Clock();
        this.players = new Map();
        // Set up world builder
        this.worldBuilder = new server_world_builder_1.ServerWorldBuilder(new THREE.Scene());
        // Build the world
        this.buildWorld();
        // Set up server weapon system
        this.serverWeaponSystem = new server_weapon_system_1.ServerWeaponSystem(this.objects);
        // Set up WebSocket server – listen on all network interfaces
        this.wss = new ws_1.WebSocketServer({ port, host: "0.0.0.0" });
        console.log(`WebSocket server started at ws://0.0.0.0:${port}`);
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
                    inputDirection: new THREE.Vector3(),
                    isJumpPressed: false,
                    isCrouchPressed: false,
                    isSprintPressed: false,
                    isFirePressed: false,
                    fireDirection: new THREE.Vector3(),
                },
                currentWeapon: config_1.WeaponType.ASSAULT_RIFLE, // Default weapon
                lastFireTime: 0,
            });
            // Send initial game state to the new client
            ws.send(JSON.stringify({
                type: 'init',
                playerId,
                players: Array.from(this.players.values()).map(p => ({
                    id: p.id,
                    position: v3(p.characterController.position),
                    yaw: p.characterController.yaw // ← include facing
                }))
            }));
            ws.on('message', (message) => {
                // Handle incoming messages from clients (e.g., input updates)
                const data = JSON.parse(message);
                if (data.type === 'input' && this.players.has(playerId)) {
                    const playerState = this.players.get(playerId);
                    playerState.input.inputDirection.set(data.inputDirection.x, data.inputDirection.y, data.inputDirection.z);
                    playerState.input.isJumpPressed = data.isJumpPressed;
                    playerState.input.isCrouchPressed = data.isCrouchPressed;
                    playerState.input.isSprintPressed = data.isSprintPressed;
                    playerState.input.isFirePressed = data.isFirePressed;
                    playerState.input.fireDirection = new THREE.Vector3(data.fireDirection.x, data.fireDirection.y, data.fireDirection.z); // Update fire input
                }
                else if (data.type === 'resetPosition' && this.players.has(playerId)) {
                    const playerState = this.players.get(playerId);
                    const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)]; // Random spawn point on reset
                    playerState.characterController.position.copy(spawnPoint);
                    playerState.characterController.velocity.set(0, 0, 0);
                    console.log(`Player ${playerId} position reset by client request.`);
                }
                else if (data.type === 'playerState' || data.type === 'playerStateUpdate') {
                    // -----------------------------------------------------------------
                    //  Client reconciliation – trust the transform it reports
                    // -----------------------------------------------------------------
                    const playerState = this.players.get(playerId);
                    if (playerState && data.position) {
                        playerState.characterController.position.set(data.position.x, data.position.y, data.position.z);
                        // zero horizontal drift; keep current vertical velocity
                        playerState.characterController.velocity.set(0, playerState.characterController.velocity.y, 0);
                        // optional facing direction
                        if (typeof data.yaw === 'number') {
                            playerState.characterController.yaw = data.yaw;
                        }
                    }
                }
            });
            ws.on('close', () => {
                console.log(`Client disconnected: ${playerId}`);
                this.players.delete(playerId);
                // Broadcast player disconnection to other clients
                this.wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === ws_1.WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'playerDisconnected', playerId: playerId }));
                    }
                });
            });
            ws.on('error', (error) => {
                console.error(`WebSocket error for ${playerId}:`, error);
            });
        });
    }
    /**
     * Build the game world
     */
    buildWorld() {
        this.objects = this.worldBuilder.buildWorld();
        // Server doesn't need to reset player position initially, clients will connect
    }
    /**
     * Start the game loop
     */
    start() {
        this.isGameRunning = true;
        this.clock.start();
        this.lastTime = this.clock.getElapsedTime();
        // Start the game loop
        this.gameLoop();
    }
    /**
     * The main server game loop
     */
    gameLoop() {
        if (!this.isGameRunning) {
            return;
        }
        const currentTime = this.clock.getElapsedTime();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        this.update(deltaTime);
        // Broadcast game state to all connected clients
        const playerStates = Array.from(this.players.values()).map(p => ({
            id: p.id,
            position: v3(p.characterController.position),
            velocity: v3(p.characterController.velocity),
            yaw: p.characterController.yaw, // ← include yaw
            state: p.characterController.getState(),
        }));
        this.wss.clients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'gameState', players: playerStates }));
            }
        });
        // Schedule the next frame (using setTimeout for server-side loop)
        setTimeout(() => this.gameLoop(), 16); // Roughly 60 FPS
    }
    /**
     * Update all game systems
     */
    update(deltaTime) {
        // Update each player's character controller
        this.players.forEach(player => {
            player.characterController.update(deltaTime, this.objects, player.input.inputDirection, player.input.isJumpPressed, player.input.isCrouchPressed, player.input.isSprintPressed);
            // Handle weapon firing on the server
            if (player.input.isFirePressed) {
                const now = Date.now();
                const config = config_1.WEAPON_CONFIGS[player.currentWeapon];
                const timeBetweenShots = 60000 / config.fireRate; // Convert RPM to ms between shots
                if (now - player.lastFireTime >= timeBetweenShots) {
                    // Assuming player's camera position and direction for firing
                    // In a real game, you'd get this from the player's character controller or a dedicated weapon component
                    const fireOrigin = player.characterController.position.clone().add(new THREE.Vector3(0, player.characterController.eyeHeight, 0));
                    // For simplicity, using a fixed forward direction for now. In a real game, this would be based on player's look direction.
                    const fireDirection = player.input.fireDirection;
                    const hitResult = this.serverWeaponSystem.fire(player.currentWeapon, fireOrigin, fireDirection);
                    player.lastFireTime = now;
                    if (hitResult.hit) {
                        console.log(`Player ${player.id} hit something at ${hitResult.hitPoint?.x}, ${hitResult.hitPoint?.y}, ${hitResult.hitPoint?.z}`);
                        // Broadcast hit event to all clients for visual effects and damage application
                        this.wss.clients.forEach((client) => {
                            if (client.readyState === ws_1.WebSocket.OPEN) {
                                client.send(JSON.stringify({ type: 'hit', hitterId: player.id, hitPoint: hitResult.hitPoint, targetId: hitResult.targetId, damage: hitResult.damageDealt }));
                            }
                        });
                    }
                }
            }
        });
        // Server-side physics and collision updates
        // The character controller's update already calls PhysicsSystem and CollisionSystem
    }
}
exports.ServerGame = ServerGame;
// --- auto-start standalone server ------------------------------------------
if (require.main === module) {
    const port = parseInt(process.env.PORT ?? '8080', 10);
    console.log(`[ServerGame] bootstrapping on ws://localhost:${port}`);
    new ServerGame(port).start();
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
//# sourceMappingURL=server-game.js.map