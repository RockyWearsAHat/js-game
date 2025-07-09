import * as THREE from "three";
import { CollisionResult } from "../core/types";

/**
 * Collision System for character movement
 * Handles all collision detection and response for the character
 */
export class CollisionSystem {
  /**
   * Performs a full collision check for the character
   * @param position Current position
   * @param objects World objects to check collision against
   * @param playerVelocity Current player velocity
   * @param playerHeight Character height (for capsule shape)
   * @param playerRadius Character radius (for capsule shape)
   * @returns CollisionResult with detailed collision information
   */
  static checkCollision(
    position: THREE.Vector3,
    objects: THREE.Object3D[],
    cameraDirection: THREE.Vector3,
    playerVelocity: THREE.Vector3,
    playerHeight: number = 1.7,
    playerRadius: number = 0.35
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

    // Constants for collision detection
    const MAX_STEP_HEIGHT = 0.5; // Maximum height the player can step up

    // Hard floor collision - this is our absolute bottom limit
    const FLOOR_HEIGHT = 0.0;
    if (position.y < FLOOR_HEIGHT + 0.05) {
      position.y = FLOOR_HEIGHT + 0.05; // Keep slightly above ground
      result.isOnGround = true;
      result.adjustedPosition.y = position.y;
      result.groundHeight = FLOOR_HEIGHT;
      return result;
    }

    // Capsule collision (pill shape) parameters - use actual height
    // const capsuleBottom = new THREE.Vector3(position.x, position.y, position.z);
    // const capsuleTop = new THREE.Vector3(
    //   position.x,
    //   position.y + playerHeight,
    //   position.z
    // );

    // Store original position
    // const originalY = position.y;

    // Use proper ground detection system with multiple rays at foot level
    const groundDetectionPoints = [
      // Center ray - most important for stability
      new THREE.Vector3(position.x, position.y + 0.1, position.z),

      // Corner rays for more precise detection
      new THREE.Vector3(
        position.x + playerRadius * 0.7,
        position.y + 0.1,
        position.z + playerRadius * 0.7
      ),
      new THREE.Vector3(
        position.x + playerRadius * 0.7,
        position.y + 0.1,
        position.z - playerRadius * 0.7
      ),
      new THREE.Vector3(
        position.x - playerRadius * 0.7,
        position.y + 0.1,
        position.z + playerRadius * 0.7
      ),
      new THREE.Vector3(
        position.x - playerRadius * 0.7,
        position.y + 0.1,
        position.z - playerRadius * 0.7
      ),
    ];

    // Initialize ground detection variables
    let closestGroundPoint = -Infinity; // For highest ground point (closest to player)
    let lowestGroundPoint = Infinity; // For lowest ground point detected
    let anyGroundDetected = false;
    let groundNormal = new THREE.Vector3(0, 1, 0);

    // The minimum height we want to maintain above the ground for stability
    const MIN_GROUND_CLEARANCE = 0.02; // Lower for more stable ground contact
    const GROUND_TOLERANCE = 0.25; // was 0.10 → allow jump while sprinting

    // Cast rays downward for ground detection
    for (const rayStart of groundDetectionPoints) {
      const downRay = new THREE.Raycaster(
        rayStart,
        new THREE.Vector3(0, -1, 0), // Straight down
        0,
        2.0 // Longer range to detect ground even when falling
      );

      const downIntersects = downRay.intersectObjects(objects, true); // Use recursive flag to check children

      if (downIntersects.length > 0) {
        const groundHit = downIntersects[0];
        const hitPoint = groundHit.point.y;
        anyGroundDetected = true;

        // Find highest ground point (for stepping up)
        if (hitPoint > closestGroundPoint) {
          closestGroundPoint = hitPoint;
        }

        // Find lowest ground point (for basic ground detection)
        if (hitPoint < lowestGroundPoint) {
          lowestGroundPoint = hitPoint;

          // Store the normal from the lowest point for slope calculations
          if (groundHit.face) {
            groundNormal = groundHit.face.normal.clone();
            groundNormal.transformDirection(groundHit.object.matrixWorld);
          }

          result.objectBelow = groundHit.object;
        }

        // Store the hit point if it's from the center ray (for interaction)
        if (
          Math.abs(rayStart.x - position.x) < 0.01 &&
          Math.abs(rayStart.z - position.z) < 0.01
        ) {
          result.hitPoint = groundHit.point.clone();
        }
      }
    }

    // Process ground information if we detected any ground
    if (anyGroundDetected) {
      // Calculate distance to ground
      const distanceToGround = position.y - lowestGroundPoint;

      // Distance to the highest detected ground point (for stepping)
      // const distanceToHighestGround = position.y - closestGroundPoint;

      // Height difference between lowest and highest ground points
      const stepHeight = closestGroundPoint - lowestGroundPoint;

      // Calculate slope information
      const angleFromUp = groundNormal.angleTo(new THREE.Vector3(0, 1, 0));
      result.slopeAngle = angleFromUp * (180 / Math.PI);
      result.slopeNormal = groundNormal;
      result.isOnSlope = result.slopeAngle > 5 && result.slopeAngle < 60;
      result.groundHeight = lowestGroundPoint;

      // On ground detection - within a small threshold
      if (distanceToGround <= GROUND_TOLERANCE) {
        result.isOnGround = true;

        // Lock exactly to ground height + clearance (no jitter)
        const targetHeight = lowestGroundPoint + MIN_GROUND_CLEARANCE;
        position.y = targetHeight;
        result.adjustedPosition.y = targetHeight;

        // On ground, zero vertical velocity
        playerVelocity.y = 0;
      }
      // Step up detection - more sophisticated
      else if (playerVelocity.y <= 0 && distanceToGround <= MAX_STEP_HEIGHT) {
        const horizontalSpeed = new THREE.Vector3(
          playerVelocity.x,
          0,
          playerVelocity.z
        ).length();

        // Improved step-up logic:
        // 1. Must have detectable horizontal movement (not just falling)
        // 2. Step height must be within reasonable limits
        // 3. Reduce velocity on step-up for smoother transitions
        if (horizontalSpeed > 0.01 && stepHeight < MAX_STEP_HEIGHT) {
          result.isOnGround = true;
          result.canStepUp = true;

          // Step up to the highest ground point detected + clearance
          const stepUpHeight = closestGroundPoint + MIN_GROUND_CLEARANCE;
          position.y = stepUpHeight;
          result.adjustedPosition.y = stepUpHeight;

          // Slightly reduce horizontal speed when stepping up
          playerVelocity.x *= 0.9;
          playerVelocity.z *= 0.9;
        }
      }
    }

    // Horizontal collision detection using capsule-like approach
    // Cast multiple rays around the player for better collision detection
    const horizontalRayDirections = [];
    const rayCount = 8; // Number of rays to cast horizontally

    // Generate evenly spaced ray directions around the player
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      horizontalRayDirections.push(
        new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
      );
    }

    // Cast rays at multiple different heights for better coverage
    // This fixes issues with missing collisions at certain heights
    const rayHeights = [0.2, playerHeight * 0.5, playerHeight * 0.8];
    const rayDistance = playerRadius + 0.05; // slightly more than player radius

    let horizontalCollision = false;
    let wallNormal = new THREE.Vector3();

    for (const rayHeight of rayHeights) {
      for (const dir of horizontalRayDirections) {
        const rayStart = new THREE.Vector3(
          position.x,
          position.y + rayHeight,
          position.z
        );

        const ray = new THREE.Raycaster(rayStart, dir, 0, rayDistance);
        const intersects = ray.intersectObjects(objects, true); // Use recursive flag

        if (intersects.length > 0) {
          const hit = intersects[0];

          // Skip if this is what we're standing on
          if (
            hit.object === result.objectBelow &&
            hit.point.y < position.y + 0.4
          )
            continue;

          // Skip non-collidable objects
          if (hit.object.userData && hit.object.userData.nonCollidable)
            continue;

          // Handle movable objects
          if (hit.object.userData && hit.object.userData.isMovable) {
            // Apply push force based on movement direction
            const pushStrength = 0.04;
            const mass = hit.object.userData.mass || 1;
            const pushAmount = pushStrength / mass;

            const pushVector = dir
              .clone()
              .multiplyScalar(
                pushAmount *
                  Math.max(
                    Math.abs(playerVelocity.x),
                    Math.abs(playerVelocity.z)
                  )
              );

            hit.object.position.x += pushVector.x;
            hit.object.position.z += pushVector.z;
          }

          // Calculate slide direction along the wall
          const normal = hit.face
            ? hit.face.normal.clone()
            : dir.clone().negate();
          normal.transformDirection(hit.object.matrixWorld);
          normal.y = 0; // Keep it horizontal
          normal.normalize();

          // Store wall normal for external use (mantling, etc)
          wallNormal.copy(normal);

          // Push player away from collision
          const pushBack = normal
            .clone()
            .multiplyScalar(rayDistance - hit.distance + 0.05);

          position.add(pushBack);
          result.adjustedPosition.add(pushBack);

          // Adjust velocity to slide along walls instead of stopping completely
          if (playerVelocity.lengthSq() > 0) {
            // Calculate slide direction along the wall
            const dot = playerVelocity.dot(normal);

            if (dot < 0) {
              // Remove the component of velocity that's going into the wall
              const slideDirection = new THREE.Vector3().copy(playerVelocity);
              slideDirection.sub(normal.multiplyScalar(dot));

              // Apply this slide direction
              playerVelocity.x = slideDirection.x;
              playerVelocity.z = slideDirection.z;

              // Mark that we had a collision
              horizontalCollision = true;
            }
          }
        }
      }
    }

    if (horizontalCollision) {
      result.collisionDirection = "horizontal";
      result.wallNormal = wallNormal;
    }

    // Check for ledge grabbing opportunities
    this.checkForLedges(
      position,
      cameraDirection,
      objects,
      playerHeight,
      result
    );

    return result;
  }

  /**
   * Check for ledges that can be grabbed
   */
  private static checkForLedges(
    position: THREE.Vector3,
    lookDirection: THREE.Vector3,
    objects: THREE.Object3D[],
    playerHeight: number,
    result: CollisionResult
  ): void {
    // Only check for ledges if we're not on the ground
    if (result.isOnGround) return;

    // Look for ledges at the right height - slightly above eye level
    const grabHeight = position.y + playerHeight * 0.8;
    const ledgeRay = new THREE.Raycaster(
      new THREE.Vector3(
        position.x + lookDirection.x * 0.3,
        grabHeight,
        position.z + lookDirection.z * 0.3
      ),
      lookDirection,
      0,
      0.7 // Search distance
    );

    const ledgeIntersects = ledgeRay.intersectObjects(objects, true);

    if (ledgeIntersects.length > 0) {
      const hit = ledgeIntersects[0];

      // Skip non-climbable objects
      if (hit.object.userData && hit.object.userData.nonClimbable) return;

      // Now check if there's space above the ledge
      const aboveRay = new THREE.Raycaster(
        new THREE.Vector3(
          hit.point.x - lookDirection.x * 0.1,
          hit.point.y + 0.5, // Check above the ledge
          hit.point.z - lookDirection.z * 0.1
        ),
        new THREE.Vector3(0, -1, 0), // Look down
        0,
        0.8 // Search distance
      );

      const aboveIntersects = aboveRay.intersectObjects(objects, true);

      if (aboveIntersects.length > 0 && aboveIntersects[0].face) {
        // Check that the surface is relatively flat
        const normal = aboveIntersects[0].face.normal.clone();
        normal.transformDirection(aboveIntersects[0].object.matrixWorld);
        const angleFromUp = normal.angleTo(new THREE.Vector3(0, 1, 0));

        // Only grab relatively flat surfaces
        if (angleFromUp < 0.3 && hit.face) {
          result.canGrabLedge = true;
          result.ledgeInfo = {
            point: hit.point.clone(),
            normal: hit.face.normal.clone(),
            object: hit.object,
          };

          // Store the position where the player can stand on the ledge
          result.ledgeInfo.point.y = aboveIntersects[0].point.y;
        }
      }
    }
  }
}
