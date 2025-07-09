import * as THREE from "three";
import { WebSocket, WebSocketServer } from 'ws';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { ServerCharacterController } from "./server-character-controller";
import { ServerWorldBuilder } from "./server-world-builder";
import { ServerWeaponSystem } from "./server-weapon-system";
import { WEAPON_CONFIGS, WeaponType } from "../core/config";
import * as os from 'os';
import { ServerConfig } from './server-config';
import { InputState } from "../core/types";

// --- helper -------------------------------------------------
const v3 = (v: THREE.Vector3) => ({ x: v.x, y: v.y, z: v.z });
// ------------------------------------------------------------

interface PlayerState {
  id: string;
  characterController: ServerCharacterController;
  input: InputState;
  // Add other player-specific data here, e.g., weapon state
  currentWeapon: WeaponType;
  lastFireTime: number;
}

/**
 * Server-side Game class
 *
 * Manages the game loop and coordinates all game systems for a dedicated server.
 * No rendering or direct user input handling.
 */
export class ServerGame {
  // Game systems
  worldBuilder!: ServerWorldBuilder;
  serverWeaponSystem!: ServerWeaponSystem;

  // Game objects
  objects: THREE.Object3D[] = [];

  // Game state
  clock: THREE.Clock;
  lastTime: number = 0;
  isGameRunning: boolean = false;

  // Networking
  httpServer: http.Server;
  wss: WebSocketServer;
  players: Map<string, PlayerState>;
  private nextPlayerId: number = 0;
  private spawnPoints: THREE.Vector3[] = [
    new THREE.Vector3(-20, 1.5, 0),
    new THREE.Vector3(20, 1.5, 0),
    new THREE.Vector3(0, 1.5, -20),
    new THREE.Vector3(0, 1.5, 20),
  ];
  private currentSpawnPointIndex: number = 0;

  /**
   * Create a new server game instance
   */
  constructor(port: number) {
    this.clock = new THREE.Clock();
    this.players = new Map<string, PlayerState>();

    // Create HTTP server to serve static files and handle WebSockets
    this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));

    // Set up world builder
    this.worldBuilder = new ServerWorldBuilder(new THREE.Scene());

    // Build the world
    this.buildWorld();

    // Set up server weapon system
    this.serverWeaponSystem = new ServerWeaponSystem(this.objects);

    // Set up WebSocket server and attach it to the HTTP server
    this.wss = new WebSocketServer({ server: this.httpServer });
    
    this.httpServer.listen(port, "0.0.0.0", () => {
      console.log(`Server started. Listening for HTTP and WebSocket connections on port ${port}`);
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const playerId = `player_${this.nextPlayerId++}`;
      console.log(`Client connected: ${playerId}`);

      // Create a new character controller for the connected player
      const newPlayerController = new ServerCharacterController();
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
        currentWeapon: WeaponType.PISTOL,
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
        currentWeapon: WeaponType.PISTOL,
      }));

      ws.on('message', (message: string) => {
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
            } else if (data.type === 'weapon_switch') {
              const newWeapon = data.weapon as WeaponType;
              if (WEAPON_CONFIGS[newWeapon]) {
                playerState.currentWeapon = newWeapon;
                this.broadcastToAll(JSON.stringify({
                  type: 'weapon_switch',
                  playerId,
                  weapon: newWeapon,
                }));
              }
            }
          }
        } catch (error) {
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
      if ((error as any).code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please ensure no other process is using this port.`);
      }
    });
  }

  /**
   * Handle incoming HTTP requests to serve static files
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Path to the distribution folder where client assets are located
    // server-game.js is in dist/server/server, client files are in dist/
    const publicDir = path.resolve(__dirname, '..', '..');
    let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url!);

    // Security: prevent directory traversal
    if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
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
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content, 'utf-8');
            }
          });
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${error.code}`);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }

  /**
   * Build the game world
   */
  buildWorld(): void {
    this.worldBuilder.build();
    this.objects.push(...this.worldBuilder.getCollisionObjects());
  }

  /**
   * Start the server game loop
   */
  start(): void {
    if (this.isGameRunning) return;
    this.isGameRunning = true;
    this.lastTime = this.clock.getElapsedTime();
    console.log('Server game loop started.');
    this.update();
  }

  /**
   * Stop the server game loop
   */
  stop(): void {
    this.isGameRunning = false;
    console.log('Server game loop stopped.');
  }

  /**
   * The main game loop
   */
  private update = (): void => {
    if (!this.isGameRunning) return;

    const currentTime = this.clock.getElapsedTime();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Update all players
    this.players.forEach((playerState, playerId) => {
      playerState.characterController.update(
        deltaTime,
        this.objects,
        playerState.input,
        playerState.input.jump
      );

      // Handle firing
      if (playerState.input.fire) {
        const weaponConfig = WEAPON_CONFIGS[playerState.currentWeapon];
        const timeSinceLastFire = Date.now() - playerState.lastFireTime;
        if (timeSinceLastFire > 1000 / (weaponConfig.fireRate / 60)) {
          playerState.lastFireTime = Date.now();
          
          // Calculate firing direction from quaternion
          const fireDirection = new THREE.Vector3(0, 0, -1);
          fireDirection.applyQuaternion(playerState.characterController.quaternion);

          this.serverWeaponSystem.fire(
            playerState.characterController.position,
            fireDirection,
            playerState.currentWeapon,
            playerId
          );
        }
      }
    });

    // Broadcast game state to all clients
    this.broadcastGameState();

    // Schedule the next update
    setTimeout(this.update, 1000 / 60); // 60 FPS
  };

  /**
   * Broadcast game state to all connected clients
   */
  private broadcastGameState(): void {
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
  private getWorldState(): any {
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
  private broadcastToAll(message: string): void {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast a message to all clients except one
   */
  private broadcastToAllExcept(exceptPlayerId: string, message: string): void {
    this.wss.clients.forEach(client => {
      // Make sure to associate playerId with the ws connection
      // This is a simplified check; you'd implement this association on connection.
      const playerSocket = client as any; 
      if (playerSocket.playerId !== exceptPlayerId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

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

function getServerAddress(): string {
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
const wss = new WebSocketServer({ 
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
    if (ws._isAlive === false) return ws.terminate();
    
    // @ts-ignore
    ws._isAlive = false;
    ws.ping();
  });
}, ServerConfig.pingInterval);

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
