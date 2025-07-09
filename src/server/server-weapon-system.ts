import * as THREE from "three";
import { WEAPON_CONFIGS, WeaponType } from "../core/config";

/**
 * Server-side Weapon System - handles weapons, shooting, and projectiles authoritatively
 */
export class ServerWeaponSystem {
  private sceneObjects: THREE.Object3D[]; // Reference to all collidable objects in the world

  constructor(sceneObjects: THREE.Object3D[]) {
    this.sceneObjects = sceneObjects;
  }

  /**
   * Server-side fire logic
   * @param weaponType The type of weapon being fired
   * @param fireOrigin The position from which the shot originates (e.g., player's camera position)
   * @param fireDirection The direction of the shot (e.g., player's camera forward vector)
   * @returns An object containing hit information (if any)
   */
  fire(
    fireOrigin: THREE.Vector3,
    fireDirection: THREE.Vector3,
    weaponType: WeaponType,
    _shooterId: string
  ): {
    hit: boolean;
    hitPoint?: THREE.Vector3;
    hitNormal?: THREE.Vector3;
    targetId?: string;
    damageDealt?: number;
  } {
    const config = WEAPON_CONFIGS[weaponType];

    // Apply weapon accuracy (spread) on the server
    const direction = fireDirection.clone();
    const spread = (1 - config.accuracy) * 0.1;
    direction.x += (Math.random() - 0.5) * spread;
    direction.y += (Math.random() - 0.5) * spread;
    direction.z += (Math.random() - 0.5) * spread;
    direction.normalize();

    // Raycast to see what we hit
    const raycaster = new THREE.Raycaster(fireOrigin, direction);
    const intersects = raycaster.intersectObjects(this.sceneObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      // In a real game, you'd identify the object hit and apply damage
      // For now, we'll just return the hit information
      return {
        hit: true,
        hitPoint: hit.point,
        hitNormal: hit.face?.normal,
        targetId: hit.object.uuid, // Or some other unique ID for the object
        damageDealt: config.damage,
      };
    }

    return { hit: false };
  }

  // Other server-side weapon logic (e.g., reload, weapon switching) can be added here
}
