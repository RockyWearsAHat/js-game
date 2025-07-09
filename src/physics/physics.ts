import * as THREE from "three";
import { CollisionResult } from "../core/types";

/**
 * Physics System for the game
 * Handles gravity, jumping and other physics-based interactions
 */
export class PhysicsSystem {
  /**
   * Apply gravity to the player's velocity
   */
  static applyGravity(
    velocity: THREE.Vector3,
    collisionData: CollisionResult
  ): THREE.Vector3 {
    if (collisionData.isOnGround) {
      // If on ground, ensure vertical velocity is zero
      velocity.y = 0;

      // If on steep slope, apply slope sliding
      if (collisionData.isOnSlope && collisionData.slopeAngle > 35) {
        // Calculate slide direction based on slope normal
        const slideDirection = new THREE.Vector3(0, -1, 0).cross(
          new THREE.Vector3()
            .crossVectors(collisionData.slopeNormal, new THREE.Vector3(0, 1, 0))
            .normalize()
        );

        // Apply slide force - more pronounced on steeper slopes
        const slideFactor = Math.min(1, (collisionData.slopeAngle - 35) / 15);
        const slideSpeed = 0.025;
        velocity.x += slideDirection.x * slideSpeed * slideFactor * 1.5;
        velocity.z += slideDirection.z * slideSpeed * slideFactor * 1.5;
      }
    } else {
      // Apply gravity when in air with a smooth approach to terminal velocity
      const gravity = 0.006;
      const maxFallSpeed = 0.25;
      const currentFallSpeed = Math.abs(velocity.y);
      const fallAcceleration =
        gravity * (1 - (currentFallSpeed / maxFallSpeed) * 0.5);
      velocity.y -= fallAcceleration;

      // Apply terminal velocity
      if (velocity.y < -maxFallSpeed) velocity.y = -maxFallSpeed;
    }
    return velocity;
  }

  /**
   * Apply jump force to the player's velocity
   */
  static applyJump(
    velocity: THREE.Vector3,
    jumpRequested: boolean,
    canJump: boolean,
    collisionData: CollisionResult
  ): THREE.Vector3 {
    if (jumpRequested && canJump && collisionData.isOnGround) {
      // Calculate jump direction based on slope normal
      const jumpDir = new THREE.Vector3(0, 1, 0);
      const jumpForce = 0.16;

      // If on slope, adjust jump direction slightly with more effect
      if (collisionData.isOnSlope) {
        jumpDir.x += collisionData.slopeNormal.x * 0.4;
        jumpDir.z += collisionData.slopeNormal.z * 0.4;
        jumpDir.normalize();
      }

      // Apply jump force with momentum conservation
      velocity.y = jumpForce;

      // Preserve horizontal momentum and add a bit extra in jump direction
      // This makes jumping on slopes and during movement feel more natural
      velocity.x = velocity.x * 0.8 + jumpDir.x * jumpForce * 0.6;
      velocity.z = velocity.z * 0.8 + jumpDir.z * jumpForce * 0.6;
    }
    return velocity;
  }

  /**
   * Update player position based on velocity and collision data
   */
  static updatePosition(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    collisionData: CollisionResult
  ): THREE.Vector3 {
    // Use the adjusted position from collision detection if available
    if (collisionData && collisionData.adjustedPosition) {
      position.copy(collisionData.adjustedPosition);
    } else {
      position.add(velocity);
    }
    return position;
  }
}
