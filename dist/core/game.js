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
exports.Game = void 0;
const THREE = __importStar(require("three"));
/**
 * Base Game class
 *
 * Manages the core game state and loop, shared between client and server.
 */
class Game {
    /**
     * Create a new game instance
     */
    constructor() {
        // Game objects
        this.objects = [];
        // Game state
        this.isGameRunning = false;
        this.lastTime = 0;
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.players = new Map();
        this.network = null;
    }
    /**
     * Set the network manager for the game.
     * @param network - The network manager instance.
     */
    setNetwork(network) {
        this.network = network;
    }
    /**
     * Start the game loop
     */
    start() {
        if (this.isGameRunning) {
            return;
        }
        console.log("Starting game...");
        this.isGameRunning = true;
        this.clock.start();
        this.lastTime = this.clock.getElapsedTime();
        this.gameLoop();
    }
    /**
     * Stop the game loop
     */
    stop() {
        console.log("Stopping game...");
        this.isGameRunning = false;
        this.clock.stop();
    }
    /**
     * The main game loop.
     * This should be called recursively with requestAnimationFrame on the client,
     * and with a fixed-step interval on the server.
     */
    gameLoop() {
        if (!this.isGameRunning) {
            return;
        }
        const currentTime = this.clock.getElapsedTime();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        // Update game logic
        this.update(deltaTime);
        // On the client, this will be called with requestAnimationFrame
        // On the server, this will be called in a fixed-step loop
    }
    /**
     * Adds a player to the game.
     * @param id - The player's unique ID.
     * @param state - The initial state of the player.
     */
    addPlayer(id, state) {
        this.players.set(id, state);
        // Note: Adding the player's 3D object to the scene is handled by the client/server implementation
    }
    /**
     * Removes a player from the game.
     * @param id - The player's unique ID.
     */
    removePlayer(id) {
        this.players.delete(id);
        // Note: Removing the player's 3D object from the scene is handled by the client/server implementation
    }
    /**
     * Updates the state of a player.
     * @param id - The player's unique ID.
     * @param state - The new state of the player.
     */
    updatePlayerState(id, state) {
        this.players.set(id, state);
    }
    /**
     * Get the current state of all players.
     */
    getPlayers() {
        return this.players;
    }
    /**
     * Get the scene.
     */
    getScene() {
        return this.scene;
    }
    /**
     * Get all collidable objects in the world.
     */
    getObjects() {
        return this.objects;
    }
}
exports.Game = Game;
