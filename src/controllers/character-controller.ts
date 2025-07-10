import * as THREE from "three";
import { CollisionResult, CharacterState } from "../core/types";
// @ts-ignore
import { CollisionSystem } from "../physics/collision";

/**
 * Character Controller
 *
 * A comprehensive controller for first-person parkour movement
 * Features:
 * - Walking, running, sprinting
 * - Jumping with momentum preservation
 * - Crouching and sliding
 * - Step-up for stairs/curbs
 * - Slope handling
 * - Ledge grabbing and mantling
 * - Head bobbing for walking
 * - FOV changes for sprint
 */
export class CharacterController {
  // Character physical properties
  position: THREE.Vector3;
  velocity: THREE.Vector3;
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
  isSliding: boolean;
  isSprinting: boolean;
  isGrabbingLedge: boolean;
  canJump: boolean;
  jumpCooldown: number;
  canMantleTimer: number;

  // Movement params
  walkSpeed: number;
  sprintSpeed: number;
  crouchSpeed: number;
  airControl: number;
  jumpForce: number;
  cameraObject: THREE.Camera | null;
  isLocalPlayer: boolean;
  headBobActive: boolean;
  headBobTimer: number;
  headBobAmount: number;
  groundedTimer: number;

  // Mantling and parkour
  ledgeGrabPoint: THREE.Vector3 | null = null;
  ledgeGrabNormal: THREE.Vector3 | null = null;
  mantleProgress: number = 0;
  isMantling: boolean = false;

  // Wall running
  isWallRunning: boolean = false;
  wallRunTimer: number = 0;
  wallRunMaxTime: number = 3.0; // Maximum wall run time in seconds
  wallRunDirection: THREE.Vector3 | null = null;
  wallNormal: THREE.Vector3 | null = null;

  // FOV settings
  defaultFOV: number = 75;
  sprintFOV: number = 85;
  currentFOV: number = 75;

  // Debug tracking
  debugInfo: any = {};

  private static readonly GROUND_TOLERANCE = 0.25;   // keep in sync with CollisionSystem
  private pitch: number = 0;
  public yaw: number = 0;
  private mouseSensitivity: number = 0.002;

  /**
   * Create a new character controller
   */
  constructor(camera: THREE.Camera | null = null, isLocalPlayer: boolean = false) {
    // Initialize position from camera
    this.position = new THREE.Vector3();
    if (camera?.position) {
      this.position.copy(camera.position);
    }
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Store the camera object for later use
    this.cameraObject = camera;
    this.isLocalPlayer = isLocalPlayer;

    // Setup physical dimensions
    this.standingHeight = 1.7;
    this.standingEyeHeight = 1.5;
    this.crouchHeight = 0.9;
    this.crouchEyeHeight = 0.7;

    // Set current dimensions
    this.height = this.standingHeight;
    this.eyeHeight = this.standingEyeHeight;
    this.radius = 0.4;

    // Initialize states
    this.isOnGround = false;
    this.isJumping = false;
    this.isCrouching = false;
    this.isSliding = false;
    this.isSprinting = false;
    this.isGrabbingLedge = false;
    this.canJump = true;
    this.jumpCooldown = 0;
    this.canMantleTimer = 0;

    // Movement params
    this.walkSpeed = 5.0; // Faster base movement
    this.sprintSpeed = 8.0; // Much faster sprint for dynamic gameplay
    this.crouchSpeed = 3.0; // Slightly faster crouch
    this.airControl = 0.6; // Better air control for parkour
    this.jumpForce = 8.0;
    this.groundedTimer = 0;

    // Head bobbing
    this.headBobActive = false;
    this.headBobTimer = 0;
    this.headBobAmount = 0.05;
  }

  public handleMouseMove(dx: number, dy: number): void {
    if (!this.isLocalPlayer || !this.cameraObject) return;
    this.updateCamera(dx, dy);
  }

  public updateCamera(dx: number, dy: number): void {
    if (!this.cameraObject) return;

    this.yaw -= dx * this.mouseSensitivity;
    this.pitch -= dy * this.mouseSensitivity;

    // Clamp pitch to prevent camera flipping
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));

    this.cameraObject.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  /**
   * Resets the character's position and velocity to a default state.
   */
  public reset(): void {
    this.position.set(0, 10, 0); // Reset to a safe position above the ground
    this.velocity.set(0, 0, 0);
    this.pitch = 0;
    this.yaw = 0;
    this.isJumping = false;
    this.isOnGround = false;
    console.log("Character position reset.");
  }

  /**
   * Set the initial position of the character
   * @param position - The initial position vector.
   */
  setInitialPosition(position: { x: number; y: number; z: number }): void {
    this.position.set(position.x, position.y, position.z);
    if (this.cameraObject) {
      this.cameraObject.position.set(position.x, position.y + this.eyeHeight, position.z);
    }
  }

  /**
   * Update the character controller
   * @param deltaTime Time since last frame in seconds
   * @param objects World objects to collide with
   * @param inputDirection Movement input direction vector
   * @param isJumpPressed Whether the jump button is pressed
   * @param isCrouchPressed Whether the crouch button is pressed
   * @param isSprintPressed Whether the sprint button is pressed
   */
  update(
    deltaTime: number,
    objects: THREE.Object3D[],
    inputDirection: THREE.Vector3,
    isJumpPressed: boolean,
    isCrouchPressed: boolean,
    isSprintPressed: boolean
  ): void {
    // ---------------- PRE-UPDATE CHECKS ----------------
    // If on ground, reset vertical velocity before any calculations
    if (this.isOnGround) {
      this.velocity.y = 0;
    }
    // ----------------------------------------------------

    // ---------------- CROUCHING LOGIC ----------------
    if (isCrouchPressed) {
      if (!this.isCrouching) {
        this.isCrouching = true;
        this.height = this.crouchHeight;
        this.eyeHeight = this.crouchEyeHeight;
      }
    } else {
      if (this.isCrouching) {
        // TODO: Add a check for space above before standing up
        this.isCrouching = false;
        this.height = this.standingHeight;
        this.eyeHeight = this.standingEyeHeight;
      }
    }
    // ----------------------------------------------------

    // ---------------- NORMALISE INPUT ----------------
    const normInput = inputDirection.clone();
    normInput.y = 0;                              // ignore vertical
    if (normInput.lengthSq() > 1) normInput.normalize();
    // -------------------------------------------------

    // Store previous state for transition detection
    const wasOnGround = this.isOnGround;
    // @ts-ignore
    const wasCrouching = this.isCrouching;

    // Update timers
    if (this.canMantleTimer > 0) this.canMantleTimer -= deltaTime;
    this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);

    // Handle crouching toggle
    this.handleCrouching(isCrouchPressed);

    // Handle sprinting
    this.handleSprinting(isSprintPressed);

    // Apply movement (horizontal) with normalised input
    this.applyMovement(normInput, deltaTime);

    // Handle ledge grabbing and mantling before applying gravity
    this.handleLedgeGrabbing(objects);

    if (this.isGrabbingLedge) {
      // Handle ledge movement and mantling
      this.handleLedgeMovement(normInput, isJumpPressed, objects);
    } else if (this.isMantling) {
      // Update mantling animation
      this.updateMantling(deltaTime);
    } else {
      // Check for wall running if not on ground and moving
      if (!this.isOnGround && normInput.length() > 0) {
        this.handleWallRunning(
          deltaTime,
          normInput,
          objects,
          isJumpPressed
        );
      }

      // Regular movement: apply gravity unless on ground
      if (!this.isOnGround && !this.isGrabbingLedge && !this.isMantling) {
        this.applyGravity(deltaTime);
      }

      // PROPER JUMP SYSTEM - Prevents flying, works while moving
      const COYOTE_TIME = 0.1; // Reduced coyote time for more responsive feel
      const JUMP_COOLDOWN = 0.2; // Minimum time between jumps

      // Handle jumping with proper ground restriction and cooldown
      if (isJumpPressed && this.canJump && this.jumpCooldown <= 0) {
        // DEBUG: Log jump attempt details
        console.log("JUMP ATTEMPT:", {
          isOnGround: this.isOnGround,
          groundedTimer: this.groundedTimer.toFixed(3),
          velocity: {
            x: this.velocity.x.toFixed(3),
            y: this.velocity.y.toFixed(3),
            z: this.velocity.z.toFixed(3),
          },
          horizontalSpeed: Math.sqrt(
            this.velocity.x * this.velocity.x +
              this.velocity.z * this.velocity.z
          ).toFixed(3),
          inputDirection: {
            x: normInput.x.toFixed(3),
            z: normInput.z.toFixed(3),
          },
        });

        // Ground jump - most common case
        if (
          this.isOnGround ||
          (this.groundedTimer > 0 && this.groundedTimer < COYOTE_TIME)
        ) {
          this.jump();
          this.canJump = false; // Prevent spam jumping / flying
          this.jumpCooldown = JUMP_COOLDOWN; // Set cooldown
          console.log(
            "✅ Ground jump executed! Sprint:",
            this.isSprinting,
            "OnGround:",
            this.isOnGround,
            "Grounded timer:",
            this.groundedTimer.toFixed(3)
          );
        }
        // Wall jump if not on ground and near wall
        else if (this.checkForWallJump(objects)) {
          this.performWallJump();
          this.canJump = false; // Prevent spam jumping
          this.jumpCooldown = JUMP_COOLDOWN; // Set cooldown
          console.log("✅ Wall jump executed!");
        }
        // Ledge grab attempt as fallback
        else {
          this.attemptLedgeGrab(objects);
          console.log(
            "❌ Jump failed - trying ledge grab. OnGround:",
            this.isOnGround,
            "VelY:",
            this.velocity.y.toFixed(3)
          );
        }
      }

      // Reset canJump when jump button is released (important for preventing spam)
      if (!isJumpPressed && !this.canJump && this.jumpCooldown <= 0) {
        this.canJump = true;
      }
    }

    // Apply velocity to position with improved collision handling
    const newPosition = this.position.clone().add(this.velocity.clone().multiplyScalar(deltaTime));

    // Full collision check with enhanced safety
    const collisionResult = this.checkFullCollision(newPosition, objects);

    // Update position and ground state
    this.position.copy(collisionResult.adjustedPosition);
    this.isOnGround = collisionResult.isOnGround;

    // If we are on the ground, clamp vertical velocity to zero to prevent jittering.
    if (this.isOnGround) {
        this.velocity.y = 0;
    }

    // allow jump even if slightly above ground while moving fast
    if (
      isJumpPressed &&
      !this.isJumping &&
      (
        this.isOnGround ||
        (collisionResult.groundHeight !== undefined &&
         this.position.y - collisionResult.groundHeight <= CharacterController.GROUND_TOLERANCE)
      )
    ) {
      this.jump();
    }

    // ENHANCED: If we hit a wall, immediately stop velocity in that direction
    if (
      collisionResult.collisionDirection !== null &&
      collisionResult.wallNormal
    ) {
      const velocityTowardWall = this.velocity.dot(
        collisionResult.wallNormal.clone().negate()
      );
      if (velocityTowardWall > 0) {
        // Remove the component of velocity going into the wall
        const wallComponent = collisionResult.wallNormal
          .clone()
          .multiplyScalar(velocityTowardWall);
        this.velocity.sub(wallComponent);

        // Add slight bounce-back to prevent sticking
        this.velocity.add(
          collisionResult.wallNormal.clone().multiplyScalar(0.02)
        );

        // Reduce overall velocity to prevent jitter
        this.velocity.multiplyScalar(0.8);
      }
    }

    // Stop wall running when landing
    if (this.isOnGround && this.isWallRunning) {
      this.stopWallRunning();
    }

    // Ground state change detection
    if (!wasOnGround && this.isOnGround) {
      // Just landed
      this.onLanding();
    } else if (wasOnGround && !this.isOnGround) {
      // Just left the ground
      this.groundedTimer = 0;
    }

    if (this.isOnGround) {
      this.groundedTimer += deltaTime;
      this.velocity.y = 0; // Reset vertical velocity on ground
      // Only reset canJump if we've been on ground for a bit (prevents immediate re-jump)
      if (this.groundedTimer > 0.05 && this.jumpCooldown <= 0) {
        this.canJump = true;
      }
    }

    // Debug: Log sprint and ground state periodically for sprint jump debugging
    if (Math.random() < 0.02) {
      // 2% chance per frame for more frequent logging
      // console.log("Movement Debug:", {
      //   isSprinting: this.isSprinting,
      //   isOnGround: this.isOnGround,
      //   groundedTimer: this.groundedTimer.toFixed(3),
      //   velocity: {
      //     x: this.velocity.x.toFixed(3),
      //     y: this.velocity.y.toFixed(3),
      //     z: this.velocity.z.toFixed(3),
      //   },
      //   position: {
      //     x: this.position.x.toFixed(2),
      //     y: this.position.y.toFixed(2),
      //     z: this.position.z.toFixed(2),
      //   },
      // });
    }

    // Update camera position for correct eye height
    this.updateCameraPosition();

    // Apply head bobbing when moving on ground
    this.applyHeadBob(deltaTime, normInput);

    // Apply FOV based on movement state
    this.updateFOV();

    // Update debug info
    this.updateDebugInfo();
  }

  /**
   * Get the current state of the character.
   */
  getState(): CharacterState {
    const viewDirection = new THREE.Vector3(0, 0, -1);
    if (this.cameraObject) {
      viewDirection.applyQuaternion(this.cameraObject.quaternion);
    }

    return {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      viewDirection: viewDirection,
      yaw: this.yaw, // Add yaw to the state
      isCrouching: this.isCrouching,
      isSprinting: this.isSprinting,
      isJumping: this.isJumping,
      isOnGround: this.isOnGround,
    };
  }

  /**
   * Handle crouching state changes
   */
  handleCrouching(isCrouchPressed: boolean): void {
    // Toggle crouching state
    if (isCrouchPressed && !this.isCrouching && !this.isGrabbingLedge) {
      // Start crouching
      this.isCrouching = true;
      this.height = this.crouchHeight;
      this.eyeHeight = this.crouchEyeHeight;

      // If we were sprinting, initiate a slide
      if (this.isSprinting && this.isOnGround) {
        this.isSliding = true;
        // Add slide boost in current direction
        const slideDir = new THREE.Vector3(
          this.velocity.x,
          0,
          this.velocity.z
        ).normalize();
        this.velocity.x += slideDir.x * 0.1;
        this.velocity.z += slideDir.z * 0.1;
      }
    } else if (!isCrouchPressed && this.isCrouching) {
      // Try to stand up - need to check for clearance
      const canStandUp = this.checkClearanceToStand();
      if (canStandUp) {
        this.isCrouching = false;
        this.isSliding = false;
        this.height = this.standingHeight;
        this.eyeHeight = this.standingEyeHeight;
      }
    }
  }

  /**
   * Handle sprinting state changes
   */
  handleSprinting(isSprintPressed: boolean): void {
    // Can't sprint while crouching
    if (this.isCrouching) {
      this.isSprinting = false;
      return;
    }

    this.isSprinting = isSprintPressed;
  }

  /**
   * FLUID MOVEMENT SYSTEM - Fast, responsive, COD + Mirror's Edge feel
   */
  applyMovement(inputDirection: THREE.Vector3, deltaTime: number): void {
    const currentSpeed = this.isSprinting
      ? this.sprintSpeed
      : this.isCrouching
      ? this.crouchSpeed
      : this.walkSpeed;

    const moveDirection = new THREE.Vector3(
      inputDirection.x,
      0,
      inputDirection.z
    );

    // Apply air control factor if not on ground
    const controlFactor = this.isOnGround ? 1.0 : this.airControl;

    // Calculate target velocity
    const targetVelocity = moveDirection.clone().multiplyScalar(
      currentSpeed * controlFactor
    );

    // Use a frame-rate independent acceleration model instead of a fixed-alpha lerp
    const acceleration = this.isOnGround ? 30.0 : 15.0; // Higher for snappier ground movement
    const currentVelocityXZ = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    const deltaVelocity = targetVelocity.sub(currentVelocityXZ);
    
    this.velocity.x += deltaVelocity.x * acceleration * deltaTime;
    this.velocity.z += deltaVelocity.z * acceleration * deltaTime;
  }

  /**
   * Apply gravity to the character
   */
  applyGravity(deltaTime: number): void {
    const GRAVITY = 22.0; // A bit stronger gravity for a less "floaty" feel
    this.velocity.y -= GRAVITY * deltaTime;
  }

  /**
   * Make the character jump - COMPLETELY UNRESTRICTED
   */
  jump(): void {
    // Stand up if crouching when jumping
    if (this.isCrouching) {
      const canStandUp = this.checkClearanceToStand();
      if (canStandUp) {
        this.isCrouching = false;
        this.isSliding = false;
        this.height = this.standingHeight;
        this.eyeHeight = this.standingEyeHeight;
      } else {
        // Can't stand to jump, so just small hop
        this.velocity.y = this.jumpForce * 0.6;
        this.isOnGround = false;
        return;
      }
    }

    // Force player slightly off the ground to ensure clean jump
    this.position.y += 0.05;

    // Apply vertical jump force
    this.velocity.y = this.jumpForce;

    // Update state
    this.isOnGround = false;
    this.isJumping = true;
    this.groundedTimer = 0;

    // NO setTimeout delays - completely unrestricted jumping
    console.log(
      "Jump executed! Velocity Y:",
      this.velocity.y.toFixed(3),
      "Sprint multiplier:",
      jumpMultiplier
    );
  }

  /**
   * Check if there's enough clearance to stand up from crouching
   */
  checkClearanceToStand(): boolean {
    // For now, just return true
    // In a full implementation, you would check for ceiling collisions
    return true;
  }

  /**
   * Handle landing after a jump or fall
   */
  onLanding(): void {
    this.isJumping = false;
    this.canJump = true;

    // Apply landing effects like camera shake or sound here
  }

  /**
   * ADVANCED COLLISION SYSTEM - Prevents all clipping, supports fluid parkour
   */
  checkFullCollision(
    position: THREE.Vector3,
    objects: THREE.Object3D[]
  ): CollisionResult {
    const result: CollisionResult = {
      isOnGround: false,
      isOnSlope: false,
      slopeAngle: 0,
      slopeNormal: new THREE.Vector3(0, 1, 0),
      collisionDirection: null,
      objectBelow: null,
      adjustedPosition: position.clone(),
      groundHeight: 0,
      canStepUp: false,
      hitPoint: null,
      wallNormal: null,
    };

    // Store original position for movement vector calculation
    const originalPosition = this.position.clone();
    const targetPosition = position.clone();
    let currentPosition = originalPosition.clone();
    const STEP_HEIGHT = 0.5;
    
    // ======== CONTINUOUS COLLISION DETECTION (SWEEP TEST) ========
    // This prevents tunneling through thin walls at high speeds
    const moveVector = new THREE.Vector3().subVectors(targetPosition, originalPosition);
    const moveDistance = moveVector.length();
    
    if (moveDistance > 0.001) {
      // We're moving fast enough to warrant sweep testing
      const moveDirection = moveVector.clone().normalize();
      const sweepRay = new THREE.Raycaster(originalPosition, moveDirection, 0, moveDistance + this.radius);
      const sweepHits = sweepRay.intersectObjects(objects, true);
      
      for (const hit of sweepHits) {
        // Skip non-collidable objects
        if (hit.object.userData && hit.object.userData.nonCollidable) continue;
        
        // If we would hit this object before reaching our target position
        if (hit.distance < moveDistance) {
          // Move just up to the hit point, minus our radius (with a small buffer)
          const safeDistance = Math.max(0, hit.distance - this.radius - 0.05);
          currentPosition.copy(originalPosition).addScaledVector(moveDirection, safeDistance);
          
          // Zero velocity in the collision direction
          const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : moveDirection.clone().negate();
          const impactSpeed = this.velocity.dot(normal.clone().negate());
          
          if (impactSpeed > 0) {
            // Remove all velocity going into the surface
            this.velocity.sub(normal.multiplyScalar(impactSpeed));
            
            // Add significant damping to prevent bouncing
            this.velocity.multiplyScalar(0.6);
          }
          
          // Store wall normal for sliding
          result.wallNormal = normal.clone();
          result.collisionDirection = "sweep";
          
          // No need to check other objects - we've already adjusted
          break;
        }
      }
    }
    
    // Use the swept/adjusted position as our starting point
    const newPos = currentPosition.clone();
    
    // ======== MULTI-PASS PENETRATION RESOLUTION ========
    // Iterate multiple times to ensure we're completely outside all objects
    const MAX_RESOLUTION_PASSES = 4;
    let totalPenetrationVector = new THREE.Vector3();
    
    for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass++) {
      let penetrationFound = false;
      let penetrationVector = new THREE.Vector3();
      let hitCount = 0;
      
      // Cast rays in many directions for thorough coverage
      const rayCount = 24; // More rays for better coverage
      const checkRadius = this.radius + 0.1; // Larger safety margin
      
      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2;
        const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        
        // Sample at multiple heights for capsule-like shape
        const heights = [
          0.1,
          this.height * 0.25,
          this.height * 0.5,
          this.height * 0.75,
          this.height * 0.95,
        ];
        
        for (const heightOffset of heights) {
          const rayStart = new THREE.Vector3(
            newPos.x, 
            newPos.y + heightOffset,
            newPos.z
          );
          
          const ray = new THREE.Raycaster(rayStart, direction, 0, checkRadius);
          const hits = ray.intersectObjects(objects, true);
          
          if (hits.length > 0) {
            const hit = hits[0];
            
            // Skip non-collidable objects
            if (hit.object.userData && hit.object.userData.nonCollidable) continue;
            
            const distance = hit.distance;
            
            // We're inside or too close to an object - calculate push force
            if (distance < this.radius) {
              penetrationFound = true;
              
              // Stronger pushback with increasing penetration depth
              const penetrationDepth = this.radius - distance;
              const pushStrength = penetrationDepth * 1.5 + 0.1; // Significantly stronger push
              
              // Push away from the wall
              const pushDir = direction.clone().negate().multiplyScalar(pushStrength);
              penetrationVector.add(pushDir);
              hitCount++;
              
              // Store wall normal for velocity adjustment
              if (hit.face) {
                const n = hit.face.normal.clone()
                           .transformDirection(hit.object.matrixWorld);
                n.y = 0; // Keep horizontal for wall sliding
                n.normalize();
                result.wallNormal = n;
              }
            }
          }
        }
      }
      
      // Apply penetration resolution if we found any overlaps
      if (penetrationFound && hitCount > 0) {
        // Average the penetration vector and apply
        penetrationVector.divideScalar(hitCount);
        newPos.add(penetrationVector);
        totalPenetrationVector.add(penetrationVector);
        
        // Store collision information
        result.collisionDirection = "penetration";
      } else {
        // No penetration found, we can exit early
        break;
      }
    }
    
    // If we had penetration, apply strong velocity dampening
    if (totalPenetrationVector.lengthSq() > 0.0001) {
      // Get average normal direction from the penetration vector
      const penetrationNormal = totalPenetrationVector.clone().normalize();
      
      // Zero out velocity in the penetration direction
      const speedIntoWall = this.velocity.dot(penetrationNormal.clone().negate());
      
      if (speedIntoWall > 0) {
        // Remove the component of velocity going into the wall
        const wallComponent = penetrationNormal.clone().multiplyScalar(speedIntoWall);
        this.velocity.sub(wallComponent);
        
        // Apply strong damping to prevent bouncing
        this.velocity.multiplyScalar(0.6);
      }
    }
    
    // ======== GROUND DETECTION ========
    // Keep existing ground detection logic but make it more reliable
    let groundFound = false;
    let highestGround = -Infinity;
    let groundNormal = new THREE.Vector3(0, 1, 0);
    let groundObject = null;
    
    // Cast more rays for better ground coverage
    const groundCheckRadius = this.radius * 0.8;
    const groundCheckPoints = [
      new THREE.Vector3(newPos.x, newPos.y + 0.15, newPos.z), // Center
      new THREE.Vector3(newPos.x + groundCheckRadius, newPos.y + 0.15, newPos.z),
      new THREE.Vector3(newPos.x - groundCheckRadius, newPos.y + 0.15, newPos.z),
      new THREE.Vector3(newPos.x, newPos.y + 0.15, newPos.z + groundCheckRadius),
      new THREE.Vector3(newPos.x, newPos.y + 0.15, newPos.z - groundCheckRadius),
      new THREE.Vector3(newPos.x + groundCheckRadius * 0.7, newPos.y + 0.15, newPos.z + groundCheckRadius * 0.7),
      new THREE.Vector3(newPos.x - groundCheckRadius * 0.7, newPos.y + 0.15, newPos.z + groundCheckRadius * 0.7),
      new THREE.Vector3(newPos.x + groundCheckRadius * 0.7, newPos.y + 0.15, newPos.z - groundCheckRadius * 0.7),
      new THREE.Vector3(newPos.x - groundCheckRadius * 0.7, newPos.y + 0.15, newPos.z - groundCheckRadius * 0.7),
    ];
    
    for (const point of groundCheckPoints) {
      const ray = new THREE.Raycaster(point, new THREE.Vector3(0, -1, 0), 0, 3.0);
      const hits = ray.intersectObjects(objects, true);
      
      if (hits.length > 0) {
        const hit = hits[0];
        
        // Skip non-collidable objects
        if (hit.object.userData && hit.object.userData.nonCollidable) continue;
        
        groundFound = true;
        
        if (hit.point.y > highestGround) {
          highestGround = hit.point.y;
          groundObject = hit.object;
          
          if (hit.face) {
            groundNormal = hit.face.normal.clone();
            groundNormal.transformDirection(hit.object.matrixWorld);
          }
        }
      }
    }
    
    if (groundFound) {
      const distanceToGround = newPos.y - highestGround;
      
      // Calculate slope information
      const slopeAngle = Math.acos(
        Math.max(-1, Math.min(1, groundNormal.dot(new THREE.Vector3(0, 1, 0))))
      ) * (180 / Math.PI);
      
      const isWalkable = slopeAngle < 50;
      
      result.slopeAngle = slopeAngle;
      result.slopeNormal = groundNormal;
      result.isOnSlope = slopeAngle > 5;
      result.objectBelow = groundObject;
      result.groundHeight = highestGround;
      
      // Horizontal speed used by step-up logic
      const horizontalSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z
      );
      
      // On-ground detection with slightly more tolerance
      if (distanceToGround <= 0.15 && isWalkable && this.velocity.y <= 0.05) {
        result.isOnGround = true;
        newPos.y = highestGround + 0.02;
        if (this.velocity.y <= 0) this.velocity.y = 0;
      }
      // Step-up system
      else if (
        distanceToGround > 0 &&
        distanceToGround <= STEP_HEIGHT &&
        isWalkable &&
        horizontalSpeed > 0.03 &&
        this.velocity.y <= 0.05
      ) {
        result.isOnGround = true;
        result.canStepUp = true;
        newPos.y = highestGround + 0.02;
        this.velocity.y = Math.max(this.velocity.y, 0);
        
        // Small movement boost for fluid step-up
        const speedBoost = 1.02;
        this.velocity.x *= speedBoost;
        this.velocity.z *= speedBoost;
      }
    }
    
    // ======== CEILING COLLISION ========
    const ceilingRay = new THREE.Raycaster(
      new THREE.Vector3(newPos.x, newPos.y + this.height - 0.05, newPos.z),
      new THREE.Vector3(0, 1, 0),
      0,
      0.25
    );
    
    const ceilingHits = ceilingRay.intersectObjects(objects, true);
    
    if (ceilingHits.length > 0) {
      // Skip non-collidable objects
      if (!(ceilingHits[0].object.userData && ceilingHits[0].object.userData.nonCollidable)) {
        if (this.velocity.y > 0) this.velocity.y = 0;
        newPos.y = Math.min(newPos.y, ceilingHits[0].point.y - this.height - 0.02);
      }
    }
    
    // Final position after all collision handling
    result.adjustedPosition = newPos;
    return result;
  }

  /**
   * Update camera position to match character position
   */
  updateCameraPosition(): void {
    if (!this.cameraObject) return;

    // Set camera at eye height
    const targetY = this.position.y + this.eyeHeight;
    this.cameraObject.position.x = this.position.x;
    this.cameraObject.position.z = this.position.z;

    // Smooth out the vertical position changes to reduce jitter
    this.cameraObject.position.y +=
      (targetY - this.cameraObject.position.y) * 0.5;
  }

  /**
   * Apply head bobbing effect when moving
   */
  // @ts-ignore
  applyHeadBob(deltaTime: number, inputDirection: THREE.Vector3): void {
    if (!this.isOnGround || !this.cameraObject) return;

    // Get horizontal movement speed
    const speed = new THREE.Vector3(
      this.velocity.x,
      0,
      this.velocity.z
    ).length();

    if (speed > 0.01) {
      // Only bob when moving
      this.headBobActive = true;

      // Calculate bob frequency based on speed
      const frequency = this.isSprinting ? 12 : 9;
      this.headBobTimer += deltaTime * frequency * speed * 10;

      // Calculate bob amount based on speed and state
      const bobAmount = this.isCrouching
        ? this.headBobAmount * 0.5
        : this.headBobAmount;
      const bobScale = this.isSprinting ? 1.3 : 1.0;

      // Apply vertical bob
      if (this.cameraObject.position) {
        this.cameraObject.position.y +=
          Math.sin(this.headBobTimer) * bobAmount * bobScale * speed;
      }
    } else {
      // Reset when not moving
      this.headBobActive = false;
      this.headBobTimer = 0;
    }
  }

  /**
   * Update the field of view based on movement state
   */
  updateFOV(): void {
    if (!(this.cameraObject instanceof THREE.PerspectiveCamera)) return;

    const camera = this.cameraObject as THREE.PerspectiveCamera;
    const targetFOV = this.isSprinting ? this.sprintFOV : this.defaultFOV;

    // Smooth transition to target FOV
    this.currentFOV += (targetFOV - this.currentFOV) * 0.1;
    camera.fov = this.currentFOV;
    camera.updateProjectionMatrix();
  }

  /**
   * DYNAMIC LEDGE GRABBING - More responsive, feels like Mirror's Edge
   */
  handleLedgeGrabbing(objects: THREE.Object3D[]): void {
    if (this.isGrabbingLedge || this.isOnGround || this.isMantling) return;

    // More generous conditions for ledge grabbing
    // Should work when jumping toward ledges or falling past them
    if (this.velocity.y > 0.3) return; // Don't grab when jumping up fast

    // Get forward direction and movement direction
    const forward = new THREE.Vector3(0, 0, -1);
    if (this.cameraObject?.quaternion) {
      forward.applyQuaternion(this.cameraObject.quaternion);
    }
    forward.y = 0;
    forward.normalize();

    // Also check movement direction for more responsive grabbing
    const movementDir = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    if (movementDir.length() > 0.05) {
      movementDir.normalize();
    } else {
      movementDir.copy(forward); // Use camera direction if not moving much
    }

    // Check for walls in both forward and movement directions
    const checkDirections = [forward];
    if (movementDir.distanceTo(forward) > 0.3) {
      checkDirections.push(movementDir);
    }

    for (const direction of checkDirections) {
      // Check for wall at multiple heights around character
      const checkHeights = [
        this.position.y + this.height * 0.6, // Chest level
        this.position.y + this.height * 0.8, // Shoulder level
        this.position.y + this.height * 0.95, // Head level
      ];

      for (const checkHeight of checkHeights) {
        const wallRay = new THREE.Raycaster(
          new THREE.Vector3(this.position.x, checkHeight, this.position.z),
          direction,
          0,
          this.radius + 0.8 // Check further out for more responsive grabbing
        );

        const wallHits = wallRay.intersectObjects(objects, true);
        if (wallHits.length === 0) continue;

        const wallHit = wallHits[0];
        const wallPoint = wallHit.point;

        // Check for ledge above the wall hit
        const ledgeCheckStart = wallPoint
          .clone()
          .add(direction.clone().multiplyScalar(-0.2));
        ledgeCheckStart.y = Math.max(checkHeight, this.position.y + 0.5); // Start from reasonable height

        const ledgeRay = new THREE.Raycaster(
          ledgeCheckStart,
          new THREE.Vector3(0, -1, 0),
          0,
          2.0 // Look down for ledge
        );

        const ledgeHits = ledgeRay.intersectObjects(objects, true);
        if (ledgeHits.length === 0) continue;

        const ledgeHit = ledgeHits[0];
        const ledgeY = ledgeHit.point.y;

        // More generous height range for ledge grabbing
        const heightDiff = ledgeY - this.position.y;
        if (heightDiff < 0.4 || heightDiff > 3.0) continue;

        // Check if ledge surface is relatively flat
        let isFlat = true;
        if (ledgeHit.face) {
          const normal = ledgeHit.face.normal.clone();
          normal.transformDirection(ledgeHit.object.matrixWorld);
          const angle =
            Math.acos(Math.abs(normal.dot(new THREE.Vector3(0, 1, 0)))) *
            (180 / Math.PI);
          isFlat = angle < 35; // More generous angle
        }

        if (!isFlat) continue;

        // SUCCESS - Grab the ledge!
        this.isGrabbingLedge = true;
        this.velocity.set(0, 0, 0);

        // Store ledge information
        this.ledgeGrabPoint = ledgeHit.point.clone();

        if (wallHit.face) {
          this.ledgeGrabNormal = wallHit.face.normal.clone();
          this.ledgeGrabNormal.transformDirection(wallHit.object.matrixWorld);
          this.ledgeGrabNormal.y = 0;
          this.ledgeGrabNormal.normalize();
        } else {
          this.ledgeGrabNormal = direction.clone().negate();
        }

        // Position player hanging from ledge with smooth transition
        const hangOffset = this.ledgeGrabNormal
          .clone()
          .multiplyScalar(this.radius + 0.2);
        this.position.x = wallPoint.x + hangOffset.x;
        this.position.z = wallPoint.z + hangOffset.z;
        this.position.y = ledgeY - this.height + 0.4; // Better hang position

        // Show action prompt
        if ((window as any).showActionPrompt) {
          (window as any).showActionPrompt(
            "SPACE: Climb up | S: Drop | A/D: Move along ledge"
          );
        }

        console.log("Grabbed ledge! Height diff:", heightDiff.toFixed(2));
        return; // Exit once we've grabbed a ledge
      }
    }
  }

  /**
   * Handle movement while hanging on ledges and mantling
   */
  handleLedgeMovement(
    inputDirection: THREE.Vector3,
    isJumpPressed: boolean,
    objects: THREE.Object3D[]
  ): void {
    if (!this.isGrabbingLedge || !this.ledgeGrabPoint || !this.ledgeGrabNormal)
      return;

    // Handle mantling (climbing up)
    if (isJumpPressed && !this.isMantling) {
      this.startMantling();
      return;
    }

    // Handle dropping down
    if (inputDirection.z < -0.5) {
      // S key pressed
      this.isGrabbingLedge = false;
      this.ledgeGrabPoint = null;
      this.ledgeGrabNormal = null;
      this.velocity.y = -0.1; // Give a small downward velocity
      if ((window as any).hideActionPrompt) (window as any).hideActionPrompt();
      return;
    }

    // Handle moving along the ledge (A/D keys)
    if (Math.abs(inputDirection.x) > 0.1) {
      const rightDirection = new THREE.Vector3();
      rightDirection.crossVectors(
        this.ledgeGrabNormal,
        new THREE.Vector3(0, 1, 0)
      );
      rightDirection.normalize();

      const moveDirection = rightDirection
        .clone()
        .multiplyScalar(inputDirection.x * 2.0);

      // Check if we can move in that direction along the ledge
      const newPosition = this.position.clone().add(moveDirection);
      const checkRay = new THREE.Raycaster(
        newPosition.clone().add(new THREE.Vector3(0, 1, 0)),
        this.ledgeGrabNormal.clone().negate(),
        0,
        this.radius + 1.0
      );

      const checkIntersects = checkRay.intersectObjects(objects, true);
      if (checkIntersects.length > 0) {
        // Safe to move along ledge
        this.position.copy(newPosition);
        this.ledgeGrabPoint.add(moveDirection);
      } else {
        // Reached end of ledge, let go
        this.isGrabbingLedge = false;
        this.ledgeGrabPoint = null;
        this.ledgeGrabNormal = null;
        if ((window as any).hideActionPrompt) (window as any).hideActionPrompt();
      }
    }
  }

  /**
   * Start the mantling process
   * (Mantling = climbing up from a hanging position)
   */
  startMantling(): void {
    if (!this.ledgeGrabPoint || !this.ledgeGrabNormal) return;

    this.isMantling = true;
    this.mantleProgress = 0;
    this.isGrabbingLedge = false;

    if ((window as any).showActionPrompt) {
      (window as any).showActionPrompt("Climbing up...");
    }
  }

  /**
   * Update mantling animation and movement
   */
  updateMantling(deltaTime: number): void {
    if (!this.isMantling || !this.ledgeGrabPoint || !this.ledgeGrabNormal)
      return;

    this.mantleProgress += deltaTime * 1.8; // Slightly faster mantling

    if (this.mantleProgress >= 1.0) {
      // Mantling complete
      this.isMantling = false;
      this.mantleProgress = 0;

      // Position player on top of the ledge
      const finalPosition = this.ledgeGrabPoint.clone();
      finalPosition.add(
        this.ledgeGrabNormal.clone().multiplyScalar(-this.radius - 0.1)
      );
      finalPosition.y += 0.1; // Slightly above ledge

      this.position.copy(finalPosition);
      this.velocity.set(0, 0, 0);

      // Clear ledge data
      this.ledgeGrabPoint = null;
      this.ledgeGrabNormal = null;

      if ((window as any).hideActionPrompt) (window as any).hideActionPrompt();
    } else {
      // Animate mantling up and forward
      const t = this.mantleProgress;
      const smoothT = t * t * (3.0 - 2.0 * t); // Smooth step function

      // Calculate target position for this frame
      const startPos = this.ledgeGrabPoint.clone();
      startPos.add(
        this.ledgeGrabNormal.clone().multiplyScalar(this.radius + 0.15)
      );
      startPos.y -= this.height - 0.3; // Starting hang position

      const endPos = this.ledgeGrabPoint.clone();
      endPos.add(
        this.ledgeGrabNormal.clone().multiplyScalar(-this.radius - 0.1)
      );
      endPos.y += 0.1; // Final position on ledge

      // Interpolate between start and end positions
      const currentPos = startPos.clone().lerp(endPos, smoothT);

      // Apply the movement as velocity for this frame
      const deltaPos = currentPos.clone().sub(this.position);
      this.velocity.copy(deltaPos.multiplyScalar(1.0 / deltaTime));
    }
  }

  /**
   * FLUID WALL RUNNING TO LEDGE SYSTEM - COD + Mirror's Edge style
   */
  handleWallRunning(
    deltaTime: number,
    inputDirection: THREE.Vector3,
    objects: THREE.Object3D[],
    isJumpPressed: boolean
  ): void {
    // If already wall running, update it
    if (this.isWallRunning) {
      this.wallRunTimer += deltaTime;

      // More generous wall run conditions
      if (
        this.wallRunTimer >= this.wallRunMaxTime * 1.5 ||
        inputDirection.length() < 0.2
      ) {
        this.stopWallRunning();
        return;
      }

      // Check if still against wall with more tolerance
      if (this.wallNormal) {
        const wallCheckDirection = this.wallNormal.clone().negate();
        const wallRay = new THREE.Raycaster(
          this.position,
          wallCheckDirection,
          0,
          this.radius + 0.25
        );
        const hits = wallRay.intersectObjects(objects, true);

        if (hits.length === 0) {
          // Lost wall contact - try to grab ledge if near top
          if (isJumpPressed) {
            this.attemptLedgeGrabFromWallRun(objects);
          } else {
            this.stopWallRunning();
          }
          return;
        }
      }

      // Apply enhanced wall running physics
      this.applyWallRunning(deltaTime, inputDirection);

      // Handle wall jump or ledge grab attempt
      if (isJumpPressed) {
        // Check if near a ledge first (prioritize ledge grab over wall jump)
        if (this.attemptLedgeGrabFromWallRun(objects)) {
          return; // Successfully grabbed ledge
        } else {
          this.performWallJump(); // Fall back to wall jump
        }
      }

      return;
    }

    // Try to start wall running - more responsive detection
    if (inputDirection.length() < 0.4) return; // Need some input to start

    // Check for walls with enhanced detection
    const checkDirections = [
      new THREE.Vector3(1, 0, 0), // Right
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(0, 0, 1), // Forward
      new THREE.Vector3(0, 0, -1), // Backward
    ];

    // Also check movement direction if different from fixed directions
    const movementDir = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    if (movementDir.length() > 0.05) {
      movementDir.normalize();
      checkDirections.push(movementDir);

      // Add perpendicular directions for side wall running
      const perpendicular = new THREE.Vector3(-movementDir.z, 0, movementDir.x);
      checkDirections.push(perpendicular);
      checkDirections.push(perpendicular.clone().negate());
    }

    for (const direction of checkDirections) {
      const wallRay = new THREE.Raycaster(
        this.position,
        direction,
        0,
        this.radius + 0.15
      );
      const hits = wallRay.intersectObjects(objects, true);

      if (hits.length > 0) {
        const wall = hits[0];

        // Check if wall is vertical enough for wall running
        if (wall.face) {
          const wallNormal = wall.face.normal.clone();
          wallNormal.transformDirection(wall.object.matrixWorld);

          // Must be mostly vertical (normal Y component should be small)
          if (Math.abs(wallNormal.y) < 0.4) {
            // More generous
            // Check if player is moving somewhat toward the wall
            const velocityTowardWall = this.velocity.dot(direction);
            const inputTowardWall = inputDirection.dot(direction);

            if (velocityTowardWall > 0.02 || inputTowardWall > 0.2) {
              // Start wall running!
              this.startWallRunning(wallNormal);
              return;
            }
          }
        }
      }
    }
  }

  /**
   * Attempt to grab ledge while wall running - SMART SYSTEM
   */
  attemptLedgeGrabFromWallRun(objects: THREE.Object3D[]): boolean {
    if (!this.wallNormal) return false;

    // Look for ledges above current position
    const searchHeight = 1.5; // Look up to 1.5m above
    const searchStart = this.position.clone();
    searchStart.y += 0.5; // Start search from chest level

    // Search in direction away from wall (where ledge would be)
    const searchDirection = this.wallNormal.clone().negate();
    searchDirection.y = 0;
    searchDirection.normalize();

    for (
      let heightOffset = 0;
      heightOffset <= searchHeight;
      heightOffset += 0.2
    ) {
      const checkPoint = searchStart.clone();
      checkPoint.y += heightOffset;
      checkPoint.add(searchDirection.clone().multiplyScalar(0.3));

      // Look down for ledge surface
      const ledgeRay = new THREE.Raycaster(
        checkPoint,
        new THREE.Vector3(0, -1, 0),
        0,
        0.8
      );

      const ledgeHits = ledgeRay.intersectObjects(objects, true);
      if (ledgeHits.length > 0) {
        const ledgeHit = ledgeHits[0];
        const ledgeY = ledgeHit.point.y;

        // Check if this is a good ledge height
        const heightDiff = ledgeY - this.position.y;
        if (heightDiff > 0.3 && heightDiff < 2.5) {
          // Check if ledge is flat enough
          let isFlat = true;
          if (ledgeHit.face) {
            const normal = ledgeHit.face.normal.clone();
            normal.transformDirection(ledgeHit.object.matrixWorld);
            const angle =
              Math.acos(Math.abs(normal.dot(new THREE.Vector3(0, 1, 0)))) *
              (180 / Math.PI);
            isFlat = angle < 35;
          }

          if (isFlat) {
            // SUCCESS - Grab the ledge from wall run!
            this.isWallRunning = false;
            this.isGrabbingLedge = true;
            this.velocity.set(0, 0, 0);

            // Store ledge information
            this.ledgeGrabPoint = ledgeHit.point.clone();
            this.ledgeGrabNormal = this.wallNormal.clone();

            // Position player hanging from ledge
            const hangOffset = this.wallNormal
              .clone()
              .multiplyScalar(this.radius + 0.2);
            this.position.x = ledgeHit.point.x + hangOffset.x;
            this.position.z = ledgeHit.point.z + hangOffset.z;
            this.position.y = ledgeY - this.height + 0.4;

            // Show action prompt
            if ((window as any).showActionPrompt) {
              (window as any).showActionPrompt(
                "SPACE: Climb up | S: Drop | A/D: Move along ledge"
              );
            }

            console.log(
              "Grabbed ledge from wall run! Height diff:",
              heightDiff.toFixed(2)
            );
            return true;
          }
        }
      }
    }

    return false; // No suitable ledge found
  }

  /**
   * Start wall running - SIMPLIFIED!
   */
  startWallRunning(wallNormal: THREE.Vector3): void {
    this.isWallRunning = true;
    this.wallRunTimer = 0;
    this.wallNormal = wallNormal.clone();
    this.wallNormal.y = 0; // Keep horizontal
    this.wallNormal.normalize();

    // Calculate wall run direction (perpendicular to wall)
    this.wallRunDirection = new THREE.Vector3();
    this.wallRunDirection.crossVectors(
      this.wallNormal,
      new THREE.Vector3(0, 1, 0)
    );
    this.wallRunDirection.normalize();

    // Choose direction based on current velocity
    const currentHorizontalVel = new THREE.Vector3(
      this.velocity.x,
      0,
      this.velocity.z
    );
    if (currentHorizontalVel.dot(this.wallRunDirection) < 0) {
      this.wallRunDirection.negate();
    }

    // Reduce downward velocity when starting wall run
    this.velocity.y = Math.max(this.velocity.y, -0.1);

    // Show action prompt
    if ((window as any).showActionPrompt) {
      (window as any).showActionPrompt("Wall Running! SPACE: Wall Jump");
    }

    console.log("Started wall running!");
  }

  /**
   * Apply enhanced wall running physics - FLUID AND RESPONSIVE
   */
  applyWallRunning(deltaTime: number, inputDirection: THREE.Vector3): void {
    if (!this.wallRunDirection || !this.wallNormal) return;

    // Enhanced gravity reduction during wall run
    const wallRunGravity = -0.002; // Very reduced gravity for longer wall runs
    this.velocity.y += wallRunGravity * deltaTime * 60;

    // Prevent falling too fast while wall running
    this.velocity.y = Math.max(this.velocity.y, -0.08);

    // If moving upward (from momentum), gradually slow the upward movement
    if (this.velocity.y > 0) {
      this.velocity.y *= 0.98; // Gradual upward velocity decay
    }

    // Enhanced movement along the wall based on input
    const baseSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    const wallRunSpeed = baseSpeed * 1.1; // Slightly faster than normal movement

    // Use input magnitude for variable speed
    const inputMagnitude = Math.min(inputDirection.length(), 1.0);
    const actualSpeed = wallRunSpeed * inputMagnitude;

    // Calculate movement direction along wall (tangent to wall surface)
    const upVector = new THREE.Vector3(0, 1, 0);
    const wallTangent = new THREE.Vector3();
    wallTangent.crossVectors(this.wallNormal, upVector);
    wallTangent.normalize();

    // Choose direction based on input and current velocity
    const inputAlongWall = inputDirection.dot(wallTangent);
    const currentAlongWall = this.velocity.dot(wallTangent);

    // Smooth direction changes
    let targetDirection = inputAlongWall;
    if (Math.abs(inputAlongWall) < 0.1) {
      // If no clear input direction, maintain current direction
      targetDirection = currentAlongWall > 0 ? 1 : -1;
    }

    // Apply movement with momentum preservation
    const targetVelocityX =
      wallTangent.x * actualSpeed * Math.sign(targetDirection);
    const targetVelocityZ =
      wallTangent.z * actualSpeed * Math.sign(targetDirection);

    // Smooth acceleration toward target velocity
    const accel = 0.15;
    this.velocity.x += (targetVelocityX - this.velocity.x) * accel;
    this.velocity.z += (targetVelocityZ - this.velocity.z) * accel;

    // Push slightly toward the wall to maintain contact
    const wallPush = this.wallNormal.clone().multiplyScalar(-0.008);
    this.velocity.add(wallPush);

    // Add slight upward boost if player is inputting forward strongly
    if (inputDirection.length() > 0.8) {
      this.velocity.y += 0.001; // Tiny upward boost for forward momentum
    }
  }

  /**
   * Check if player can perform a wall jump
   */
  checkForWallJump(objects: THREE.Object3D[]): boolean {
    // Check for walls in all directions
    const directions = [
      new THREE.Vector3(1, 0, 0), // Right
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(0, 0, 1), // Forward
      new THREE.Vector3(0, 0, -1), // Backward
    ];

    for (const direction of directions) {
      const ray = new THREE.Raycaster(
        this.position,
        direction,
        0,
        this.radius + 0.15
      );
      const hits = ray.intersectObjects(objects, true);

      if (hits.length > 0 && hits[0].face) {
        const normal = hits[0].face.normal.clone();
        normal.transformDirection(hits[0].object.matrixWorld);

        // Check if wall is vertical enough
        if (Math.abs(normal.y) < 0.3) {
          this.wallNormal = normal;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Perform wall jump
   */
  performWallJump(): void {
    if (!this.wallNormal) return;

    // Jump away from wall and upward
    const jumpAwayForce = this.wallNormal.clone().multiplyScalar(0.15);
    const jumpUpForce = 0.22;

    this.velocity.x = jumpAwayForce.x;
    this.velocity.z = jumpAwayForce.z;
    this.velocity.y = jumpUpForce;

    this.isOnGround = false;
    this.isJumping = true;
    this.groundedTimer = 0;

    // Reset wall running if active
    if (this.isWallRunning) {
      this.stopWallRunning();
    }

    console.log("Wall jump performed!");
  }

  /**
   * Attempt to grab a ledge when jumping near one
   */
  attemptLedgeGrab(objects: THREE.Object3D[]): void {
    // Try immediate ledge grab without changing the main ledge grab system
    // This is for when player presses space near a ledge
    const wasGrabbing = this.isGrabbingLedge;
    this.handleLedgeGrabbing(objects);

    if (!wasGrabbing && this.isGrabbingLedge) {
      console.log("Ledge grab attempt successful!");
    }
  }

  /**
   * Stop wall running
   */
  stopWallRunning(): void {
    this.isWallRunning = false;
    this.wallRunTimer = 0;
    this.wallRunDirection = null;
    this.wallNormal = null;

    // Hide action prompt
    if ((window as any).hideActionPrompt) (window as any).hideActionPrompt();
  }

  /**
   * Update debug information
   */
  updateDebugInfo(): void {
    this.debugInfo = {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      state: {
        isOnGround: this.isOnGround,
        isJumping: this.isJumping,
        isCrouching: this.isCrouching,
        isSprinting: this.isSprinting,
        isSliding: this.isSliding,
        isGrabbingLedge: this.isGrabbingLedge,
        isWallRunning: this.isWallRunning,
      },
    };
  }
}