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
const collision_1 = require("../physics/collision");
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
    update(deltaTime, collisionObjects, input, jump) {
        this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);
        this.handleCrouching(input.crouch);
        this.handleSprinting(input.sprint);
        this.applyMovement(input, deltaTime);
        const forward = new THREE.Vector3(0, 0, -1); // Default forward
        const collisionResult = collision_1.CollisionSystem.checkCollision(this.position, collisionObjects, forward, this.velocity.clone().multiplyScalar(deltaTime), this.height, this.radius);
        this.isOnGround = collisionResult.isOnGround;
        if (this.isOnGround) {
            this.velocity.y = 0;
            this.isJumping = false;
            this.isWallRunning = false;
            this.wallRunTimer = 0;
            this.wallRunNormal = null;
        }
        else {
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
    handleCrouching(isCrouchPressed) {
        if (isCrouchPressed) {
            this.isCrouching = true;
            this.height = this.crouchHeight;
            this.eyeHeight = this.crouchEyeHeight;
        }
        else {
            this.isCrouching = false;
            this.height = this.standingHeight;
            this.eyeHeight = this.standingEyeHeight;
        }
    }
    /**
     * Handle sprinting logic
     */
    handleSprinting(isSprintPressed) {
        this.isSprinting = isSprintPressed && this.isOnGround && !this.isCrouching;
    }
    /**
     * Handle ledge grabbing
     */
    handleLedgeGrabbing(collisionResult, isJumpPressed) {
        if (collisionResult.canGrabLedge && isJumpPressed) {
            this.isGrabbingLedge = true;
            this.velocity.set(0, 0, 0);
            this.ledgeInfo = collisionResult.ledgeInfo;
        }
    }
    /**
     * Handle wall running
     */
    handleWallRunning(collisionResult, deltaTime) {
        if (!this.isOnGround &&
            collisionResult.hasWallCollision &&
            this.wallRunTimer > 0) {
            this.isWallRunning = true;
            this.velocity.y = 0; // No gravity while wall running
            this.wallRunTimer -= deltaTime;
        }
        else {
            this.isWallRunning = false;
        }
    }
    /**
     * Apply movement based on input
     */
    applyMovement(inputState, deltaTime) {
        let speed = config_1.GameConfig.player.walkSpeed;
        if (this.isSprinting) {
            speed = config_1.GameConfig.player.sprintSpeed;
        }
        else if (this.isCrouching) {
            speed = config_1.GameConfig.player.crouchSpeed;
        }
        const moveDirection = new THREE.Vector3();
        if (inputState.moveForward)
            moveDirection.z -= 1;
        if (inputState.moveBackward)
            moveDirection.z += 1;
        if (inputState.moveLeft)
            moveDirection.x -= 1;
        if (inputState.moveRight)
            moveDirection.x += 1;
        moveDirection.normalize();
        if (this.isOnGround) {
            this.velocity.x = moveDirection.x * speed;
            this.velocity.z = moveDirection.z * speed;
        }
        else {
            // Apply air control
            const airVelocity = moveDirection.multiplyScalar(speed * config_1.GameConfig.player.airControl);
            this.velocity.x += airVelocity.x * deltaTime;
            this.velocity.z += airVelocity.z * deltaTime;
        }
    }
    /**
     * Make the character jump
     */
    jump() {
        this.velocity.y = config_1.GameConfig.player.jumpForce;
        this.isJumping = true;
        this.canJump = false;
        this.jumpCooldown = 0.5;
    }
    /**
     * Get the current state of the character
     */
    getState() {
        // The view direction will be derived from the yaw on the client side for now.
        // This should be improved to use the quaternion directly.
        const viewDirection = new THREE.Vector3(0, 0, -1);
        viewDirection.applyQuaternion(this.quaternion);
        return {
            position: this.position,
            velocity: this.velocity,
            viewDirection: viewDirection,
            isOnGround: this.isOnGround,
            isJumping: this.isJumping,
            isCrouching: this.isCrouching,
            isSprinting: this.isSprinting,
            yaw: this.yaw,
        };
    }
}
exports.ServerCharacterController = ServerCharacterController;
