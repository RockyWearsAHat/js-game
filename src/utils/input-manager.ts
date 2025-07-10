import * as THREE from "three";
import { InputState } from "../core/types";

/**
 * Input Manager
 *
 * Handles all user input for the game (keyboard and mouse)
 */
export class InputManager {
  private keys: { [key: string]: boolean } = {};
  private mouse = { x: 0, y: 0, dx: 0, dy: 0 };
  private pointerLocked = false;
  private eventListeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor(private canvas: HTMLElement) {
    document.addEventListener("keydown", this.onKeyDown.bind(this), false);
    document.addEventListener("keyup", this.onKeyUp.bind(this), false);
    document.addEventListener("mousemove", this.onMouseMove.bind(this), false);
    document.addEventListener("mousedown", this.onMouseDown.bind(this), false);
    document.addEventListener("mouseup", this.onMouseUp.bind(this), false);
    document.addEventListener("contextmenu", (e) => e.preventDefault(), false); // Disable right-click menu
    document.addEventListener(
      "pointerlockchange",
      this.onPointerLockChange.bind(this),
      false
    );

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

  on(eventName: string, callback: (event: any) => void) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  private emit(eventName: string, event: any) {
    if (this.eventListeners[eventName]) {
      for (const callback of this.eventListeners[eventName]) {
        callback(event);
      }
    }
  }

  private onKeyDown(event: KeyboardEvent) {
    this.keys[event.code] = true;
    this.emit("keydown", event);
  }

  private onKeyUp(event: KeyboardEvent) {
    this.keys[event.code] = false;
  }

  /**
   * Handle mouse move event
   */
  onMouseMove(event: MouseEvent): void {
    if (this.pointerLocked) {
      this.mouse.dx += event.movementX;
      this.mouse.dy += event.movementY;
    }
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
  }

  /**
   * Handle mouse down event
   */
  onMouseDown(event: MouseEvent): void {
    // Use event.button to check for left (0), middle (1), or right (2) mouse button
    if (event.button === 0) {
      this.keys["mouse0"] = true;
      this.keys["fire"] = true; // a more generic alias
    } else if (event.button === 2) {
      this.keys["mouse2"] = true;
      this.keys["aim"] = true; // a more generic alias
    }
  }

  /**
   * Handle mouse up event
   */
  onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.keys["mouse0"] = false;
      this.keys["fire"] = false;
    } else if (event.button === 2) {
      this.keys["mouse2"] = false;
      this.keys["aim"] = false;
    }
  }

  /**
   * Handle pointer lock change event
   */
  onPointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  }

  lockPointer() {
    if (!this.pointerLocked) {
      this.canvas.requestPointerLock();
    }
  }

  unlockPointer() {
    if (this.pointerLocked) {
      document.exitPointerLock();
    }
  }

  /**
   * Emergency key to clear stuck inputs
   */
  clearAllMovementKeys(): void {
    this.keys["KeyW"] = false;
    this.keys["KeyA"] = false;
    this.keys["KeyS"] = false;
    this.keys["KeyD"] = false;
    this.keys["Space"] = false;
    this.keys["ShiftLeft"] = false;
    this.keys["KeyC"] = false;
    this.keys["moveForward"] = false;
    this.keys["moveBackward"] = false;
    this.keys["moveLeft"] = false;
    this.keys["moveRight"] = false;
    this.keys["jump"] = false;
    this.keys["sprint"] = false;
    this.keys["crouch"] = false;
  }

  /**
   * Get the current mouse movement delta and reset it.
   */
  getMouseDelta() {
    const delta = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return delta;
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

  isJumping(): boolean {
    return this.keys["Space"] || this.keys[" "] || false;
  }

  isCrouching(): boolean {
    return this.keys["KeyC"] || this.keys["ControlLeft"] || this.keys["c"] || this.keys["C"] || this.keys["Control"] || false;
  }

  isSprinting(): boolean {
    return this.keys["ShiftLeft"] || this.keys["ShiftRight"] || this.keys["Shift"] || false;
  }

  isFiring(): boolean {
    return this.keys["mouse0"] || false;
  }

  /**
   * Get current rotation input for camera
   */
  getCameraRotation(): { x: number; y: number } {
    const rotation = {
      x: -this.mouse.y * this.mouseSensitivity, // Pitch (look up/down) - negative for natural feel
      y: -this.mouse.x * this.mouseSensitivity, // Yaw (look left/right) - negative for natural feel
    };

    // Reset mouse movement to prevent continuous rotation
    this.mouse.x = 0;
    this.mouse.y = 0;

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
      reset: this.keys["KeyR"] || this.keys["r"] || this.keys["R"] || false,
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
    return this.pointerLocked;
  }

  /**
   * Get current state of the input manager
   */
  getState() {
    return {
      forward: this.keys["KeyW"],
      backward: this.keys["KeyS"],
      left: this.keys["KeyA"],
      right: this.keys["KeyD"],
      jump: this.keys["Space"],
      sprint: this.keys["ShiftLeft"] || this.keys["ShiftRight"],
      crouch: this.keys["KeyC"],
      reset: this.keys["KeyR"],
      help: this.keys["KeyH"],
    };
  }
}
