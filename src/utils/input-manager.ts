import * as THREE from "three";
import { InputState } from "../core/types";

/**
 * Input Manager
 *
 * Handles all user input for the game (keyboard and mouse)
 */
export class InputManager {
  // Keyboard state
  keys: { [key: string]: boolean } = {};

  // Mouse state
  isPointerLocked: boolean = false;
  mouseX: number = 0;
  mouseY: number = 0;
  mouseSensitivity: number = 0.0015;

  // Touch state (for mobile)
  touchStartX: number = 0;
  touchStartY: number = 0;
  isTouching: boolean = false;

  // References to HTML elements
  canvas: HTMLElement;

  /**
   * Create a new input manager
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();

    // REQUEST LOCK ON FIRST CLICK OR WHENEVER IT IS LOST
    const requestLock = () => canvas.requestPointerLock();
    canvas.addEventListener("click", requestLock);

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement !== canvas) {
        // try to re-enter on next click
        console.warn("Pointer-lock lost – click to re-acquire");
      }
    });
  }

  /**
   * Set up all event listeners for input
   */
  setupEventListeners(): void {
    // Keyboard events
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));

    // Mouse events
    document.addEventListener("mousemove", this.handleMouseMove.bind(this));
    document.addEventListener("mousedown", this.handleMouseDown.bind(this));
    document.addEventListener("mouseup", this.handleMouseUp.bind(this));
    document.addEventListener("contextmenu", (e) => e.preventDefault()); // Disable right-click menu

    // Pointer lock events
    document.addEventListener(
      "pointerlockchange",
      this.handlePointerLockChange.bind(this)
    );

    // Click on canvas to lock pointer
    this.canvas.addEventListener("click", this.requestPointerLock.bind(this));

    // Touch events (for mobile)
    this.canvas.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this)
    );
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this));
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this));
  }

  /**
   * Handle key down event
   */
  handleKeyDown(event: KeyboardEvent): void {
    // Store the key state by its code
    this.keys[event.code] = true;

    // Also store the key by its key value for better compatibility
    this.keys[event.key] = true;

    console.log(`Key down: ${event.key} (${event.code})`);

    // Emergency key to clear stuck inputs
    if (event.code === "KeyX" || event.key === "x" || event.key === "X") {
      console.log("🔧 Manual key reset triggered by X key");
      this.clearAllMovementKeys();
      return;
    }

    // Prevent default behavior for game-related keys
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
        "w",
        "a",
        "s",
        "d",
        " ",
      ].includes(event.code) ||
      ["w", "a", "s", "d", "W", "A", "S", "D", " "].includes(event.key)
    ) {
      event.preventDefault();
    }
  }

  /**
   * Handle key up event
   */
  handleKeyUp(event: KeyboardEvent): void {
    // Clear both code and key mappings
    this.keys[event.code] = false;
    this.keys[event.key] = false;

    // Also clear common variations to prevent stuck keys
    if (event.code === "KeyW") {
      this.keys["w"] = false;
      this.keys["W"] = false;
      this.keys["KeyW"] = false;
    }
    if (event.code === "KeyS") {
      this.keys["s"] = false;
      this.keys["S"] = false;
      this.keys["KeyS"] = false;
    }
    if (event.code === "KeyA") {
      this.keys["a"] = false;
      this.keys["A"] = false;
      this.keys["KeyA"] = false;
    }
    if (event.code === "KeyD") {
      this.keys["d"] = false;
      this.keys["D"] = false;
      this.keys["KeyD"] = false;
    }

    console.log(
      `Key up: ${event.key} (${event.code}) - cleared multiple variations`
    );
  }

  /**
   * Force clear all movement keys (emergency reset)
   */
  clearAllMovementKeys(): void {
    const movementKeys = [
      "KeyW",
      "KeyS",
      "KeyA",
      "KeyD",
      "w",
      "W",
      "s",
      "S",
      "a",
      "A",
      "d",
      "D",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ];
    movementKeys.forEach((key) => {
      this.keys[key] = false;
    });
    console.log("🔧 Force cleared all movement keys");
  }

  /**
   * Handle mouse move event
   */
  handleMouseMove(event: MouseEvent): void {
    if (this.isPointerLocked) {
      this.mouseX = event.movementX || 0;
      this.mouseY = event.movementY || 0;
    } else {
      this.mouseX = 0;
      this.mouseY = 0;
    }
  }

  /**
   * Handle mouse down event
   */
  handleMouseDown(event: MouseEvent): void {
    if (!this.isPointerLocked) {
      this.requestPointerLock();
    } else {
      // Track mouse button states
      this.keys[`mouse${event.button}`] = true;
    }
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(event: MouseEvent): void {
    // Clear mouse button states
    this.keys[`mouse${event.button}`] = false;
  }

  /**
   * Handle pointer lock change
   */
  handlePointerLockChange(): void {
    console.log("Pointer lock change event triggered");
    const wasLocked = this.isPointerLocked;
    this.isPointerLocked = document.pointerLockElement === this.canvas;
    console.log("Pointer locked:", this.isPointerLocked);

    // Reset mouse movement values when lock state changes
    if (wasLocked !== this.isPointerLocked) {
      this.mouseX = 0;
      this.mouseY = 0;
    }

    // Update UI elements based on pointer lock state
    const prompt = document.getElementById("prompt");
    if (prompt) {
      prompt.classList.toggle("hidden", this.isPointerLocked);
    }
  }

  /**
   * Request pointer lock on the canvas
   */
  requestPointerLock(): void {
    try {
      if (!this.isPointerLocked) {
        console.log("Requesting pointer lock on canvas");
        this.canvas.requestPointerLock();
      }
    } catch (error) {
      console.error("Failed to request pointer lock:", error);
    }
  }

  /**
   * Handle touch start event (for mobile)
   */
  handleTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
      this.isTouching = true;
    }
  }

  /**
   * Handle touch move event (for mobile)
   */
  handleTouchMove(event: TouchEvent): void {
    if (this.isTouching && event.touches.length > 0) {
      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;

      // Calculate movement deltas
      this.mouseX = (touchX - this.touchStartX) * 0.5;
      this.mouseY = (touchY - this.touchStartY) * 0.5;

      // Update starting position for next move
      this.touchStartX = touchX;
      this.touchStartY = touchY;
    }
  }

  /**
   * Handle touch end event (for mobile)
   */
  handleTouchEnd(_event: TouchEvent): void {
    this.isTouching = false;
    this.mouseX = 0;
    this.mouseY = 0;
  }

  /**
   * Get movement input direction based on current key state
   */
  getMovementDirection(camera: THREE.Camera): THREE.Vector3 {
    const direction = new THREE.Vector3();

    // Debug: Check all movement keys
    const movementKeys = {
      w: this.keys["KeyW"] || this.keys["w"] || this.keys["W"],
      s: this.keys["KeyS"] || this.keys["s"] || this.keys["S"],
      a: this.keys["KeyA"] || this.keys["a"] || this.keys["A"],
      d: this.keys["KeyD"] || this.keys["d"] || this.keys["D"],
      arrowUp: this.keys["ArrowUp"],
      arrowDown: this.keys["ArrowDown"],
      arrowLeft: this.keys["ArrowLeft"],
      arrowRight: this.keys["ArrowRight"],
    };

    // Forward/back
    if (
      this.keys["KeyW"] ||
      this.keys["ArrowUp"] ||
      this.keys["w"] ||
      this.keys["W"]
    ) {
      direction.z = 1; // Changed from -1 to 1 (forward)
    } else if (
      this.keys["KeyS"] ||
      this.keys["ArrowDown"] ||
      this.keys["s"] ||
      this.keys["S"]
    ) {
      direction.z = -1; // Changed from 1 to -1 (backward)
    }

    // Left/right
    if (
      this.keys["KeyA"] ||
      this.keys["ArrowLeft"] ||
      this.keys["a"] ||
      this.keys["A"]
    ) {
      direction.x = -1;
    } else if (
      this.keys["KeyD"] ||
      this.keys["ArrowRight"] ||
      this.keys["d"] ||
      this.keys["D"]
    ) {
      direction.x = 1;
    }

    // Normalize for diagonal movement
    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    // Convert to camera-relative direction
    if (camera) {
      const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion
      );
      cameraDirection.y = 0;
      cameraDirection.normalize();

      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
        camera.quaternion
      );

      const forward = cameraDirection.clone().multiplyScalar(direction.z);
      const right = cameraRight.clone().multiplyScalar(direction.x);

      direction.copy(forward).add(right);
      if (direction.lengthSq() > 0) {
        direction.normalize();
      }
    }

    // Debug log when we have unexpected input
    const anyKeyPressed = Object.values(movementKeys).some(Boolean);
    const hasDirection = direction.length() > 0.1;

    // Only detect ACTUAL stuck state: direction without any keys pressed
    if (hasDirection && !anyKeyPressed) {
      console.log("🚨 STUCK INPUT BUG! Direction without keys:", {
        keys: movementKeys,
        rawDirection: { x: direction.x.toFixed(3), z: direction.z.toFixed(3) },
        length: direction.length().toFixed(3),
      });
      // Force clear when we have movement but no keys pressed
      console.log("🔧 Auto-clearing stuck keys...");
      this.clearAllMovementKeys();
    }

    if (hasDirection || anyKeyPressed) {
      console.log("INPUT DEBUG:", {
        keys: movementKeys,
        direction: {
          x: direction.x.toFixed(3),
          z: direction.z.toFixed(3),
          length: direction.length().toFixed(3),
        },
      });
    }

    return direction;
  }

  /**
   * Get current rotation input for camera
   */
  getCameraRotation(): { x: number; y: number } {
    const rotation = {
      x: -this.mouseY * this.mouseSensitivity, // Pitch (look up/down) - negative for natural feel
      y: -this.mouseX * this.mouseSensitivity, // Yaw (look left/right) - negative for natural feel
    };

    // Reset mouse movement to prevent continuous rotation
    this.mouseX = 0;
    this.mouseY = 0;

    return rotation;
  }

  /**
   * Get current input state for character controller
   */
  getInputState(): InputState {
    return {
      moveForward:
        this.keys["KeyW"] ||
        this.keys["ArrowUp"] ||
        this.keys["w"] ||
        this.keys["W"] ||
        false,
      moveBackward:
        this.keys["KeyS"] ||
        this.keys["ArrowDown"] ||
        this.keys["s"] ||
        this.keys["S"] ||
        false,
      moveLeft:
        this.keys["KeyA"] ||
        this.keys["ArrowLeft"] ||
        this.keys["a"] ||
        this.keys["A"] ||
        false,
      moveRight:
        this.keys["KeyD"] ||
        this.keys["ArrowRight"] ||
        this.keys["d"] ||
        this.keys["D"] ||
        false,
      jump: this.keys["Space"] || this.keys[" "] || false,
      sprint:
        this.keys["ShiftLeft"] ||
        this.keys["ShiftRight"] ||
        this.keys["Shift"] ||
        false,
      crouch:
        this.keys["KeyC"] ||
        this.keys["ControlLeft"] ||
        this.keys["c"] ||
        this.keys["C"] ||
        this.keys["Control"] ||
        false,
      fire: this.keys["mouse0"] || false, // Left mouse button
      reload: this.keys["KeyR"] || this.keys["r"] || this.keys["R"] || false,
      aim: this.keys["mouse2"] || false, // Right mouse button
    };
  }

  /**
   * Check if the reset position key is pressed
   */
  isResetPositionPressed(): boolean {
    return this.keys["KeyR"] || this.keys["r"] || this.keys["R"] || false;
  }

  /**
   * Check if pointer is locked
   */
  isPointerLockActive(): boolean {
    return this.isPointerLocked;
  }
}
