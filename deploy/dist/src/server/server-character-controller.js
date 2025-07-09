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
exports.ServerCharacterController = void 0;
const THREE = __importStar(require("three"));
const config_1 = require("../core/config");
/**
 * Server-side Character Controller
 *
 * A simplified controller for first-person movement, without any client-side code.
 */
class ServerCharacterController {
    /**
     * Create a new character controller
     */
    constructor() {
        this.yaw = 0; // <— new field, radians
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3(0, 0, 0);
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
    update(deltaTime, objects, inputDirection, isJumpPressed, isCrouchPressed, isSprintPressed) {
        this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);
        this.handleCrouching(isCrouchPressed);
        this.handleSprinting(isSprintPressed);
        this.applyMovement(inputDirection, deltaTime);
        // const forward = new THREE.Vector3(0, 0, -1); // Default forward
        // const collisionResult = CollisionSystem.checkCollision(
        //   this.position,
        //   objects,
        //   forward,
        //   this.velocity.clone().multiplyScalar(deltaTime),
        //   this.height,
        //   this.radius
        // );
        // this.position.copy(collisionResult.adjustedPosition);
        // this.isOnGround = collisionResult.isOnGround;
        // this.handleLedgeGrabbing(collisionResult, isJumpPressed);
        // this.handleWallRunning(collisionResult, inputDirection);
        // this.velocity = PhysicsSystem.applyGravity(
        //   this.velocity,
        //   collisionResult,
        //   this.isWallRunning
        // );
        // if (isJumpPressed && this.canJump && this.isOnGround && this.jumpCooldown <= 0) {
        //   this.jump();
        // }
        // if (!isJumpPressed) {
        //   this.canJump = true;
        // }
    }
    handleLedgeGrabbing(collisionResult, isJumpPressed) {
        if (collisionResult.canGrabLedge && !this.isGrabbingLedge) {
            this.isGrabbingLedge = true;
            this.isMantling = false;
            this.velocity.set(0, 0, 0);
            this.ledgeInfo = collisionResult.ledgeInfo;
        }
        if (this.isGrabbingLedge) {
            if (this.ledgeInfo) {
                const ledgePosition = this.ledgeInfo.point;
                const targetPosition = new THREE.Vector3(ledgePosition.x, ledgePosition.y - this.eyeHeight, ledgePosition.z);
                this.position.lerp(targetPosition, 0.1);
            }
            // Mantle
            if (isJumpPressed && this.isGrabbingLedge && !this.isMantling) {
                this.isMantling = true;
                const mantleTarget = new THREE.Vector3(this.ledgeInfo.point.x, this.ledgeInfo.point.y + this.height / 2, this.ledgeInfo.point.z);
                this.position.copy(mantleTarget);
                this.isGrabbingLedge = false;
                this.isMantling = false;
                this.ledgeInfo = null;
                this.isOnGround = true;
            }
        }
    }
    handleWallRunning(collisionResult, inputDirection) {
        const wallNormal = collisionResult.wallNormal;
        if (wallNormal && !this.isOnGround && this.velocity.y < 0) {
            const wallDirection = new THREE.Vector3().crossVectors(wallNormal, new THREE.Vector3(0, 1, 0));
            const playerDirection = new THREE.Vector3(inputDirection.x, 0, inputDirection.z).normalize();
            const dot = playerDirection.dot(wallDirection);
            if (Math.abs(dot) > 0.5) {
                this.isWallRunning = true;
                this.wallRunNormal = wallNormal;
                this.wallRunSide = dot > 0 ? "left" : "right";
                this.velocity.y = 0;
                this.wallRunTimer = 1.5; // seconds
            }
        }
        if (this.isWallRunning) {
            if (this.wallRunTimer > 0 && this.isWallRunning) {
                this.wallRunTimer -= 0.016; // Assumes 60fps
                this.velocity.y = 0;
            }
            else {
                this.isWallRunning = false;
                this.wallRunNormal = null;
                this.wallRunSide = null;
            }
        }
    }
    handleCrouching(isCrouchPressed) {
        if (isCrouchPressed && !this.isCrouching) {
            this.isCrouching = true;
            this.height = this.crouchHeight;
            this.eyeHeight = this.crouchEyeHeight;
        }
        else if (!isCrouchPressed && this.isCrouching) {
            this.isCrouching = false;
            this.height = this.standingHeight;
            this.eyeHeight = this.standingEyeHeight;
        }
    }
    handleSprinting(isSprintPressed) {
        this.isSprinting = isSprintPressed && !this.isCrouching;
    }
    applyMovement(inputDirection, deltaTime) {
        let speed = config_1.GameConfig.player.walkSpeed;
        if (this.isSprinting) {
            speed = config_1.GameConfig.player.sprintSpeed;
        }
        else if (this.isCrouching) {
            speed = config_1.GameConfig.player.crouchSpeed;
        }
        const moveDirection = new THREE.Vector3(inputDirection.x, 0, inputDirection.z).normalize();
        if (this.isOnGround) {
            const targetVelocity = moveDirection.multiplyScalar(speed);
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelocity.x, 0.2);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelocity.z, 0.2);
        }
        else {
            const airVelocity = moveDirection.multiplyScalar(speed * config_1.GameConfig.player.airControl);
            this.velocity.x += airVelocity.x * deltaTime;
            this.velocity.z += airVelocity.z * deltaTime;
        }
    }
    jump() {
        this.velocity.y = config_1.GameConfig.player.jumpForce;
        this.isOnGround = false;
        this.canJump = false;
        this.jumpCooldown = 0.5;
    }
    getState() {
        return {
            isOnGround: this.isOnGround,
            isJumping: this.isJumping,
            isCrouching: this.isCrouching,
            isSliding: false,
            isSprinting: this.isSprinting,
            isGrabbingLedge: this.isGrabbingLedge,
            isMantling: this.isMantling,
            isWallRunning: this.isWallRunning,
        };
    }
}
exports.ServerCharacterController = ServerCharacterController;
//# sourceMappingURL=server-character-controller.js.map