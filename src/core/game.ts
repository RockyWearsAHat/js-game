import * as THREE from "three";
import { CharacterController } from "../controllers/character-controller";
import { WorldBuilder } from "../world/world-builder";
import { InputManager } from "../utils/input-manager";
import { WeaponSystem } from "../systems/weapon-system";
import { WeaponType } from "../core/config";
import { NetworkManager } from "../network/network-manager";
import type { PlayerState } from "../network/network-manager";

/**
 * Main Game class
 *
 * Manages the game loop and coordinates all game systems
 */
export class Game {
  // Core THREE.js components
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;

  // Game systems
  worldBuilder!: WorldBuilder;
  characterController!: CharacterController;
  inputManager!: InputManager;
  weaponSystem!: WeaponSystem;
  networkManager!: NetworkManager;
  private remotePlayers: Map<string, THREE.Mesh> = new Map();

  // Game objects
  objects: THREE.Object3D[] = [];

  // Game state
  clock: THREE.Clock;
  lastTime: number = 0;
  isGameRunning: boolean = false;

  // Debug options
  debugMode: boolean = false;

  // keep CollisionSystem clearance plus a tiny extra to avoid the gap
  private readonly GROUND_EPSILON = 0.04;  // ← was 0.02

  /**
   * Create a new game instance
   */
  constructor(container: HTMLElement) {
    console.log("Game constructor called with container:", container);

    // Initialize the clock
    this.clock = new THREE.Clock();
    console.log("Clock initialized");

    // Set up the scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    console.log("Scene created");

    // Set up the camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 5);
    console.log("Camera position set to:", this.camera.position);

    // Set up the renderer
    try {
      console.log("Creating WebGLRenderer...");
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      console.log("WebGLRenderer created successfully");

      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      console.log("Renderer configured successfully");

      // Add renderer to container
      container.appendChild(this.renderer.domElement);
      console.log("Renderer added to container");
    } catch (error) {
      console.error("Error setting up renderer:", error);
    }
    console.log("Renderer added to container");

    // Set up input manager
    try {
      this.inputManager = new InputManager(this.renderer.domElement);
      console.log("Input manager initialized");
    } catch (error) {
      console.error("Failed to initialize input manager:", error);
    }

    // Set up world builder
    try {
      this.worldBuilder = new WorldBuilder(this.scene);
      console.log("World builder initialized");
    } catch (error) {
      console.error("Failed to initialize world builder:", error);
    }

    // Set up character controller
    try {
      this.characterController = new CharacterController(this.camera);
      console.log("Character controller initialized");
    } catch (error) {
      console.error("Failed to initialize character controller:", error);
    }

    // Set up weapon system
    try {
      this.weaponSystem = new WeaponSystem(this.scene, this.camera);
      console.log("Weapon system initialized");
    } catch (error) {
      console.error("Failed to initialize weapon system:", error);
    }

    // Set up network manager
    try {
      this.networkManager = new NetworkManager();
      this.networkManager.setOnInit(this.handleInit.bind(this));         // <-- renamed
      this.networkManager.setOnGameStateUpdate(this.handleGameStateUpdate.bind(this));
      this.networkManager.setOnPlayerConnected(this.handlePlayerConnected.bind(this));
      this.networkManager.setOnPlayerDisconnected(this.handlePlayerDisconnected.bind(this));
      this.networkManager.setOnPlayerStateUpdate(this.handlePlayerStateUpdate.bind(this)); // <-- now wired
      console.log("Network manager initialized");
    } catch (e) { console.error("Failed to init net:", e); }

    // Set up event listeners
    this._boundWindowResize = this.onWindowResize.bind(this);
    window.addEventListener("resize", this._boundWindowResize);

    // Build the world
    this.buildWorld();

    // Create weapon UI
    this.createWeaponUI();

    // Set up action prompt system
    this.setupActionPrompts();

    (window as any).game = this;   // ← access via browser console
  }

  /**
   * Set up action prompt system for parkour actions
   */
  setupActionPrompts(): void {
    // Make action prompt functions globally available
    (window as any).showActionPrompt = (message: string) => {
      const prompt = document.getElementById("action-prompt");
      if (prompt) {
        prompt.textContent = message;
        prompt.classList.add("active");
      }
    };

    (window as any).hideActionPrompt = () => {
      const prompt = document.getElementById("action-prompt");
      if (prompt) {
        prompt.classList.remove("active");
      }
    };
  }

  /**
   * Create weapon information UI
   */
  createWeaponUI(): void {
    // Remove existing UI if it exists to prevent duplicates
    const existingUI = document.getElementById("weapon-ui");
    if (existingUI) {
      existingUI.remove();
    }
    const existingControls = document.getElementById("controls-ui");
    if (existingControls) {
      existingControls.remove();
    }

    const ui = document.createElement("div");
    ui.id = "weapon-ui";
    ui.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 15px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 14px;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(ui);

    const controls = document.createElement("div");
    controls.id = "controls-ui";
    controls.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 15px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
    `;
    controls.innerHTML = `
      <div><strong>CONTROLS:</strong></div>
      <div>WASD: Move</div>
      <div>Mouse: Look</div>
      <div>Space: Jump</div>
      <div>Shift: Sprint</div>
      <div>C: Crouch</div>
      <div>Left Click: Fire</div>
      <div>Right Click: Aim</div>
      <div>R: Reload</div>
      <div>1-4: Switch Weapons</div>
    `;
    document.body.appendChild(controls);
  }

  /**
   * Build the game world
   */
  buildWorld(): void {
    console.log("Building game world...");
    try {
      // Build world & collect colliders
      this.objects = this.worldBuilder.buildWorld();
      console.log(`World built with ${this.objects.length} objects`);

      // NOTE: initial position now set by handleInit()
      // this.resetPlayerPosition();   <-- REMOVED
    } catch (error) {
      console.error("Error building world:", error);
    }
  }

  /**
   * Start the game loop
   */
  start(): void {
    console.log("Starting game...");
    this.isGameRunning = true;
    this.clock.start();
    this.lastTime = this.clock.getElapsedTime();

    // Bind gameLoop to this instance once
    this._boundGameLoop = this.gameLoop.bind(this);
    console.log("Game loop bound to this instance");

    // Start the game loop
    requestAnimationFrame(this._boundGameLoop);
    console.log("First animation frame requested");
  }

  // Bound versions of callbacks for event listeners
  private _boundGameLoop: FrameRequestCallback = () => {};
  private _boundWindowResize: () => void = () => {};

  /**
   * The main game loop
   */
  gameLoop(): void {
    if (!this.isGameRunning) {
      console.log("Game not running, skipping game loop");
      return;
    }

    // Calculate delta time
    const currentTime = this.clock.getElapsedTime();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // First frame logging
    if (currentTime < 0.1) {
      console.log("First game loop frame, deltaTime:", deltaTime);
    }

    // Update game systems
    this.update(deltaTime);

    // Render the frame
    this.render();

    // Schedule the next frame
    requestAnimationFrame(this._boundGameLoop);
  }

  // -----------------------------------------------------------
  // networking helpers
  // -----------------------------------------------------------
  private makeRemoteMesh(isLocal = false): THREE.Mesh {
    const geom = new THREE.BoxGeometry(1, 1.8, 1);
    geom.translate(0, 0.9, 0);
    const mat  = new THREE.MeshStandardMaterial({ color: isLocal ? 0xff0000 : 0x0000ff });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;

    // mark as physics collider so CollisionSystem can decide to use / ignore
    mesh.userData.noPhysics = false;     // set to true if you want only ray-hits
    return mesh;
  }

  // ---------------- helper reused by all msgs ----------------
  private updateOrCreateRemotePlayer(p: PlayerState): void {
    if (p.id === this.networkManager.getPlayerId()) return;

    let mesh = this.remotePlayers.get(p.id);
    if (!mesh) {
      mesh = this.makeRemoteMesh(false);
      this.remotePlayers.set(p.id, mesh);
      this.scene.add(mesh);

      // ---- NEW: make it collidable / shootable ----------------
      if (!this.objects.includes(mesh)) {
        this.objects.push(mesh);          // allow bullet hit-tests & physics
      }
      // ---------------------------------------------------------
    }

    mesh.position.set(
      p.position.x,
      p.position.y - this.GROUND_EPSILON,
      p.position.z
    );
    if (typeof p.yaw === "number") mesh.rotation.y = p.yaw;
  }

  private handlePlayerDisconnected(id: string): void {
    const mesh = this.remotePlayers.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.remotePlayers.delete(id);
      // ---- remove from collision list -------------------------
      const idx = this.objects.indexOf(mesh);
      if (idx !== -1) this.objects.splice(idx, 1);
      // ---------------------------------------------------------
    }
  }
  // -----------------------------------------------------------

  private handleInit(msg: { playerId: string; players: PlayerState[] }) {
    const me = msg.players.find(p => p.id === msg.playerId);
    if (me) {
      // authoritative spawn
      this.characterController.position.set(me.position.x, me.position.y, me.position.z);
      this.camera.position.set(
        me.position.x,
        me.position.y + this.characterController.eyeHeight,
        me.position.z
      );
    }
    // spawn meshes for already-connected clients
    msg.players.forEach(p => this.updateOrCreateRemotePlayer(p));
  }

  private handlePlayerConnected(player: PlayerState): void {
    this.updateOrCreateRemotePlayer(player);
  }

  private handleGameStateUpdate(players: PlayerState[]): void {
    const seen = new Set<string>();
    players.forEach((p) => {
      this.updateOrCreateRemotePlayer(p);
      seen.add(p.id);
    });
    // remove disconnected players
    [...this.remotePlayers.keys()].forEach((id) => {
      if (!seen.has(id)) this.handlePlayerDisconnected(id);
    });
  }

  private handlePlayerStateUpdate(player: PlayerState): void {
    this.updateOrCreateRemotePlayer(player);
  }

  /**
   * Update all game systems
   */
  update(deltaTime: number): void {
    // Check for reset position
    if (this.inputManager.isResetPositionPressed()) {
      this.resetPlayerPosition();
    }

    // Get input state
    const inputDirection = this.inputManager.getMovementDirection(this.camera);
    const inputState = this.inputManager.getInputState();

    // Update camera rotation
    if (this.inputManager.isPointerLockActive()) {
      const rotation = this.inputManager.getCameraRotation();

      // Get current rotation values
      const currentPitch = this.camera.rotation.x;
      const currentYaw = this.camera.rotation.y;

      // Calculate new pitch with clamping
      const newPitch = Math.max(
        Math.min(currentPitch + rotation.x, Math.PI / 2 - 0.1),
        -Math.PI / 2 + 0.1
      );

      // Calculate new yaw
      const newYaw = currentYaw + rotation.y;

      // Set rotation using Euler angles with explicit order to prevent gimbal lock
      this.camera.rotation.set(newPitch, newYaw, 0, "YXZ");
    }

    // Update character controller
    this.characterController.update(
      deltaTime,
      this.objects,
      inputDirection,
      inputState.jump,
      inputState.crouch,
      inputState.sprint
    );

    // Update weapon system
    this.weaponSystem.update(deltaTime);

    // Handle weapon inputs
    if (inputState.fire) {
      this.weaponSystem.fire(this.objects);
    }

    if (inputState.reload) {
      this.weaponSystem.startReload();
    }

    this.weaponSystem.setAiming(inputState.aim);

    // Handle weapon switching (1-4 keys)
    if (this.inputManager.keys["Digit1"] || this.inputManager.keys["1"]) {
      this.weaponSystem.switchWeapon(WeaponType.ASSAULT_RIFLE);
    } else if (
      this.inputManager.keys["Digit2"] ||
      this.inputManager.keys["2"]
    ) {
      this.weaponSystem.switchWeapon(WeaponType.PISTOL);
    } else if (
      this.inputManager.keys["Digit3"] ||
      this.inputManager.keys["3"]
    ) {
      this.weaponSystem.switchWeapon(WeaponType.SNIPER);
    } else if (
      this.inputManager.keys["Digit4"] ||
      this.inputManager.keys["4"]
    ) {
      this.weaponSystem.switchWeapon(WeaponType.SMG);
    }

    // Apply weapon recoil to camera
    const recoilOffset = this.weaponSystem.getWeaponInfo().recoilOffset;
    if (recoilOffset && this.inputManager.isPointerLockActive()) {
      // Apply recoil as temporary rotation offset
      this.camera.rotation.x += recoilOffset.y * 0.5;
      this.camera.rotation.y += recoilOffset.x * 0.5;
    }

    // -------------------------------------------------------
    //  Send local player input to the server
    // -------------------------------------------------------
    const fireDir = new THREE.Vector3();
    this.camera.getWorldDirection(fireDir);

    // world-axis WASD vector –1…1 (server expects this)
    const netDir = new THREE.Vector3(
      (this.inputManager.keys["KeyD"]  ? 1 : 0) - (this.inputManager.keys["KeyA"] ? 1 : 0),
      0,
      (this.inputManager.keys["KeyS"]  ? 1 : 0) - (this.inputManager.keys["KeyW"] ? 1 : 0)
    );

    this.networkManager.sendInput(
      netDir,                 // use world-axis dir for server
      inputState.jump,
      inputState.crouch,
      inputState.sprint,
      inputState.fire,
      fireDir
    );

    // --- transmit our latest world-space position every frame -----------
    this.networkManager.sendPlayerState(
      this.characterController.position,
      this.camera.rotation.y     // facing direction (optional)
    );
    // --------------------------------------------------------------------

    // Update weapon UI
    this.updateWeaponUI();
  }

  /**
   * Update weapon UI with current weapon information
   */
  updateWeaponUI(): void {
    const ui = document.getElementById("weapon-ui");
    if (ui && this.weaponSystem) {
      const weaponInfo = this.weaponSystem.getWeaponInfo();
      ui.innerHTML = `
        <div><strong>${weaponInfo.weaponType.toUpperCase()}</strong></div>
        <div>Ammo: ${weaponInfo.currentAmmo} / ${weaponInfo.maxAmmo}</div>
        ${
          weaponInfo.isReloading
            ? '<div style="color: yellow;">RELOADING...</div>'
            : ""
        }
      `;
    }
  }

  /**
   * Render the current frame
   */
  render(): void {
    try {
      this.log("render frame, children:", this.scene.children.length);
      this.renderer.render(this.scene, this.camera);
    } catch (err) {
      console.error("Render error:", err);
    }
  }

  /**
   * Handle window resize events
   */
  onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Reset player position to the start
   */
  resetPlayerPosition(): void {
    this.characterController.position.set(-20, 1.5, 0);
    this.characterController.velocity.set(0, 0, 0);
    this.camera.position.copy(this.characterController.position);
    this.camera.position.y += this.characterController.eyeHeight;
    this.camera.rotation.set(0, 0, 0);
  }

  /**
   * Toggle debug mode
   */
  toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    this.networkManager.setDebug(this.debugMode);  // forward to WS layer
  }

  // helper
  private log(...args: unknown[]) {
    if (this.debugMode) console.log(...args);
  }
}