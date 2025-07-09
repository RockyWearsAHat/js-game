import * as THREE from "three";
import { InputState, CollisionResult, CharacterState } from "../core/types";
import { CollisionSystem } from "../physics/collision";
import { GameConfig } from "../core/config";

/**
 * Server-side Character Controller
 *
 * A simplified controller for first-person movement, without any client-side code.
 */
export class ServerCharacterController {
  // Character physical properties
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  height: number;
  radius: number;
  eyeHeight: number;
  crouchHeight: number;
  crouchEyeHeight: number;
  standingHeight: number;
  standingEyeHeight: number;

  // Movement state
  isOnGround: boolean;
  isJumping: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  canJump: boolean;
  jumpCooldown: number;
  isWallRunning: boolean;
  wallRunSide: "left" | "right" | null;
  wallRunTimer: number;
  wallRunNormal: THREE.Vector3 | null;
  isGrabbingLedge: boolean;
  isMantling: boolean;
  ledgeInfo: any | null;

  public yaw = 0; // <— new field, radians

  /**
   * Create a new character controller
   */
  constructor() {
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.quaternion = new THREE.Quaternion();

    // Setup physical dimensions
    this.standingHeight = 1.8;
    this.standingEyeHeight = 1.6;
    this.crouchHeight = 1.2;
    this.crouchEyeHeight = 1.0;

    this.height = this.standingHeight;
    this.eyeHeight = this.standingEyeHeight;
    this.radius = 0.4;

    // Initialize states
    this.isOnGround = false;
    this.isJumping = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.canJump = true;
    this.jumpCooldown = 0;
    this.isWallRunning = false;
    this.wallRunSide = null;
    this.wallRunTimer = 0;
    this.wallRunNormal = null;
    this.isGrabbingLedge = false;
    this.isMantling = false;
    this.ledgeInfo = null;

    this.yaw = 0;
  }

  /**
   * Update the character controller
   */
  update(
    deltaTime: number,
    collisionObjects: THREE.Object3D[],
    input: InputState,
    jump: boolean
  ): void {
    this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);

    this.handleCrouching(input.crouch);
    this.handleSprinting(input.sprint);
    this.applyMovement(input, deltaTime);

    const forward = new THREE.Vector3(0, 0, -1); // Default forward

    const collisionResult = CollisionSystem.checkCollision(
      this.position,
      collisionObjects,
      forward,
      this.velocity.clone().multiplyScalar(deltaTime),
      this.height,
      this.radius
    );

    this.isOnGround = collisionResult.isOnGround;

    if (this.isOnGround) {
      this.velocity.y = 0;
      this.isJumping = false;
      this.isWallRunning = false;
      this.wallRunTimer = 0;
      this.wallRunNormal = null;
    } else {
      this.velocity.y -= 9.81 * deltaTime; // Apply gravity
    }

    this.handleLedgeGrabbing(collisionResult, jump);
    this.handleWallRunning(collisionResult, deltaTime);

    if (jump && this.canJump && this.isOnGround) {
      this.jump();
    }

    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
  }

  /**
   * Handle crouching logic
   */
  handleCrouching(isCrouchPressed: boolean): void {
    if (isCrouchPressed) {
      this.isCrouching = true;
      this.height = this.crouchHeight;
      this.eyeHeight = this.crouchEyeHeight;
    } else {
      this.isCrouching = false;
      this.height = this.standingHeight;
      this.eyeHeight = this.standingEyeHeight;
    }
  }

  /**
   * Handle sprinting logic
   */
  handleSprinting(isSprintPressed: boolean): void {
    this.isSprinting = isSprintPressed && !this.isCrouching;
  }

  /**
   * Handle ledge grabbing
   */
  handleLedgeGrabbing(collisionResult: CollisionResult, isJumpPressed: boolean): void {
    if (collisionResult.canGrabLedge && isJumpPressed) {
      this.isGrabbingLedge = true;
      this.velocity.set(0, 0, 0);
      this.ledgeInfo = collisionResult.ledgeInfo;
    }
  }

  /**
   * Handle wall running
   */
  handleWallRunning(
    collisionResult: CollisionResult,
    deltaTime: number
  ): void {
    if (
      !this.isOnGround &&
      collisionResult.hasWallCollision &&
      this.wallRunTimer > 0
    ) {
      this.isWallRunning = true;
      this.velocity.y = 0; // No gravity while wall running
      this.wallRunTimer -= deltaTime;
    } else {
      this.isWallRunning = false;
    }
  }

  /**
   * Apply movement based on input
   */
  applyMovement(inputState: InputState, deltaTime: number): void {
    let speed = GameConfig.player.walkSpeed;
    if (this.isSprinting) {
      speed = GameConfig.player.sprintSpeed;
    } else if (this.isCrouching) {
      speed = GameConfig.player.crouchSpeed;
    }

    const moveDirection = new THREE.Vector3();
    if (inputState.moveForward) moveDirection.z -= 1;
    if (inputState.moveBackward) moveDirection.z += 1;
    if (inputState.moveLeft) moveDirection.x -= 1;
    if (inputState.moveRight) moveDirection.x += 1;
    moveDirection.normalize();

    if (this.isOnGround) {
      this.velocity.x = moveDirection.x * speed;
      this.velocity.z = moveDirection.z * speed;
    } else {
      // Apply air control
      const airVelocity = moveDirection.multiplyScalar(speed * GameConfig.player.airControl);
      this.velocity.x += airVelocity.x * deltaTime;
      this.velocity.z += airVelocity.z * deltaTime;
    }
  }

  /**
   * Make the character jump
   */
  jump(): void {
    this.velocity.y = GameConfig.player.jumpForce;
    this.isJumping = true;
    this.canJump = false;
    this.jumpCooldown = 0.5;
  }

  /**
   * Get the current state of the character
   */
  getState(): CharacterState {
    return {
      isOnGround: this.isOnGround,
      isJumping: this.isJumping,
      isCrouching: this.isCrouching,
      isSliding: false, // Implement sliding logic if needed
      isSprinting: this.isSprinting,
      isGrabbingLedge: this.isGrabbingLedge,
      isMantling: this.isMantling,
      isWallRunning: this.isWallRunning,
    };
  }
}
