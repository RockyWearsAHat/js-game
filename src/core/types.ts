// Core type definitions for the parkour game
import * as THREE from "three";

// Collision result interface with comprehensive details
export interface CollisionResult {
  isOnGround: boolean;
  isOnSlope: boolean;
  slopeAngle: number;
  slopeNormal: THREE.Vector3;
  collisionDirection: string | null;
  objectBelow: any; // THREE.Object3D
  adjustedPosition: THREE.Vector3;
  groundHeight: number;
  canStepUp: boolean;
  hitPoint: THREE.Vector3 | null;
  wallNormal: THREE.Vector3 | null;
  ceilingHeight?: number;
  canGrabLedge?: boolean;
  hasWallCollision?: boolean;
  ledgeInfo?: {
    point: THREE.Vector3;
    normal: THREE.Vector3;
    object: any; // THREE.Object3D
  };
}

// Character state interface
export interface CharacterState {
  isOnGround: boolean;
  isJumping: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  isSprinting: boolean;
  isGrabbingLedge: boolean;
  isMantling: boolean;
  isWallRunning: boolean;
}

// Input state interface
export interface InputState {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  fire: boolean;
  reload: boolean;
  aim: boolean;
}



export interface WeaponState {
  currentAmmo: number;
  isReloading: boolean;
  lastFireTime: number;
  reloadStartTime: number;
}

// Bullet/projectile interface
export interface Projectile {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  range: number;
  travelDistance: number;
  startTime: number;
}
