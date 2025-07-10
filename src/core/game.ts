import * as THREE from "three";
import { PlayerState } from "../core/types";

/**
 * Base Game class
 *
 * Manages the core game state and loop, shared between client and server.
 */
export abstract class Game {
  // Core components
  public scene: THREE.Scene;
  protected clock: THREE.Clock;

  // Game objects
  public objects: THREE.Object3D[] = [];
  protected players: Map<string, PlayerState>;

  // Game state
  protected isGameRunning: boolean = false;
  private lastTime: number = 0;

  // Network handler
  protected network: any; // Can be NetworkManager on client, or something else on server

  /**
   * Create a new game instance
   */
  constructor() {
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.players = new Map<string, PlayerState>();
    this.network = null;
  }

  /**
   * Set the network manager for the game.
   * @param network - The network manager instance.
   */
  setNetwork(network: any): void {
    this.network = network;
  }

  /**
   * Start the game loop
   */
  start(): void {
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
  stop(): void {
    console.log("Stopping game...");
    this.isGameRunning = false;
    this.clock.stop();
  }

  /**
   * The main game loop.
   * This should be called recursively with requestAnimationFrame on the client,
   * and with a fixed-step interval on the server.
   */
  protected gameLoop(): void {
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
   * Abstract update method to be implemented by subclasses (ClientGame, ServerGame).
   * @param deltaTime - The time since the last frame.
   */
  abstract update(deltaTime: number): void;

  /**
   * Adds a player to the game.
   * @param id - The player's unique ID.
   * @param state - The initial state of the player.
   */
  addPlayer(id: string, state: PlayerState): void {
    this.players.set(id, state);
    // Note: Adding the player's 3D object to the scene is handled by the client/server implementation
  }

  /**
   * Removes a player from the game.
   * @param id - The player's unique ID.
   */
  removePlayer(id: string): void {
    this.players.delete(id);
    // Note: Removing the player's 3D object from the scene is handled by the client/server implementation
  }

  /**
   * Updates the state of a player.
   * @param id - The player's unique ID.
   * @param state - The new state of the player.
   */
  updatePlayerState(id: string, state: PlayerState): void {
    this.players.set(id, state);
  }

  /**
   * Get the current state of all players.
   */
  getPlayers(): Map<string, PlayerState> {
    return this.players;
  }

  /**
   * Get the scene.
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get all collidable objects in the world.
   */
  getObjects(): THREE.Object3D[] {
    return this.objects;
  }
}