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
exports.PhysicsSystem = void 0;
const THREE = __importStar(require("three"));
/**
 * Physics System for the game
 * Handles gravity, jumping and other physics-based interactions
 */
class PhysicsSystem {
    /**
     * Apply gravity to the player's velocity
     */
    static applyGravity(velocity, collisionData) {
        if (collisionData.isOnGround) {
            // If on ground, ensure vertical velocity is zero
            velocity.y = 0;
            // If on steep slope, apply slope sliding
            if (collisionData.isOnSlope && collisionData.slopeAngle > 35) {
                // Calculate slide direction based on slope normal
                const slideDirection = new THREE.Vector3(0, -1, 0).cross(new THREE.Vector3()
                    .crossVectors(collisionData.slopeNormal, new THREE.Vector3(0, 1, 0))
                    .normalize());
                // Apply slide force - more pronounced on steeper slopes
                const slideFactor = Math.min(1, (collisionData.slopeAngle - 35) / 15);
                const slideSpeed = 0.025;
                velocity.x += slideDirection.x * slideSpeed * slideFactor * 1.5;
                velocity.z += slideDirection.z * slideSpeed * slideFactor * 1.5;
            }
        }
        else {
            // Apply gravity when in air with a smooth approach to terminal velocity
            const gravity = 0.006;
            const maxFallSpeed = 0.25;
            const currentFallSpeed = Math.abs(velocity.y);
            const fallAcceleration = gravity * (1 - (currentFallSpeed / maxFallSpeed) * 0.5);
            velocity.y -= fallAcceleration;
            // Apply terminal velocity
            if (velocity.y < -maxFallSpeed)
                velocity.y = -maxFallSpeed;
        }
        return velocity;
    }
    /**
     * Apply jump force to the player's velocity
     */
    static applyJump(velocity, jumpRequested, canJump, collisionData) {
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
    static updatePosition(position, velocity, collisionData) {
        // Use the adjusted position from collision detection if available
        if (collisionData && collisionData.adjustedPosition) {
            position.copy(collisionData.adjustedPosition);
        }
        else {
            position.add(velocity);
        }
        return position;
    }
}
exports.PhysicsSystem = PhysicsSystem;
