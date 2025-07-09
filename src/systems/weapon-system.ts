import * as THREE from "three";
import { WEAPON_CONFIGS, WeaponType } from "../core/config";
import {
    WeaponState,
    Projectile,
} from "../core/types";

/**
 * Weapon System - handles weapons, shooting, and projectiles
 */
export class WeaponSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private currentWeapon: WeaponType;
  private weaponState: WeaponState;
  private projectiles: Map<string, Projectile> = new Map();
  private weaponMesh: THREE.Group | null = null;
  private muzzleFlash: THREE.PointLight | null = null;
  private crosshair: HTMLElement | null = null;

  // Recoil and aim state
  private recoilOffset: THREE.Vector2 = new THREE.Vector2(0, 0);
  private aimingDownSights: boolean = false;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.currentWeapon = WeaponType.ASSAULT_RIFLE;

    this.weaponState = {
      currentAmmo: WEAPON_CONFIGS[this.currentWeapon].magazineSize,
      isReloading: false,
      lastFireTime: 0,
      reloadStartTime: 0,
    };

    this.initializeWeaponModel();
    this.initializeCrosshair();
    this.initializeMuzzleFlash();
  }

  /**
   * Initialize a simple weapon model
   */
  private initializeWeaponModel(): void {
    this.weaponMesh = new THREE.Group();

    // Create a simple gun shape
    const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.025, 0.5, 8);
    const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.3, -0.2, -0.4);

    // Gun body
    const bodyGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.3);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0.2, -0.15, -0.2);

    // Stock
    const stockGeometry = new THREE.BoxGeometry(0.05, 0.08, 0.2);
    const stockMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const stock = new THREE.Mesh(stockGeometry, stockMaterial);
    stock.position.set(0.15, -0.12, 0.1);

    this.weaponMesh.add(barrel);
    this.weaponMesh.add(body);
    this.weaponMesh.add(stock);

    // Add to camera (first-person view)
    this.camera.add(this.weaponMesh);
  }

  /**
   * Initialize crosshair UI
   */
  private initializeCrosshair(): void {
    this.crosshair = document.createElement("div");
    this.crosshair.id = "crosshair";
    this.crosshair.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 4px;
      height: 4px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.5);
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(this.crosshair);
  }

  /**
   * Initialize muzzle flash effect
   */
  private initializeMuzzleFlash(): void {
    this.muzzleFlash = new THREE.PointLight(0xffaa00, 2, 3);
    this.muzzleFlash.visible = false;
    this.camera.add(this.muzzleFlash);
    this.muzzleFlash.position.set(0.5, -0.2, -0.4);
  }

  /**
   * Fire the current weapon
   */
  fire(targetObjects: THREE.Object3D[]): boolean {
    const now = Date.now();
    const config = WEAPON_CONFIGS[this.currentWeapon];
    const timeBetweenShots = 60000 / config.fireRate; // Convert RPM to ms between shots

    // Check if we can fire
    if (
      this.weaponState.isReloading ||
      this.weaponState.currentAmmo <= 0 ||
      now - this.weaponState.lastFireTime < timeBetweenShots
    ) {
      return false;
    }

    // Fire the weapon
    this.weaponState.currentAmmo--;
    this.weaponState.lastFireTime = now;

    // Create projectile
    this.createProjectile(targetObjects);

    // Visual/audio effects
    this.triggerMuzzleFlash();
    this.applyRecoil();

    // Auto-reload if empty
    if (this.weaponState.currentAmmo <= 0) {
      this.startReload();
    }

    return true;
  }

  /**
   * Create and fire a projectile
   */
  private createProjectile(targetObjects: THREE.Object3D[]): void {
    const config = WEAPON_CONFIGS[this.currentWeapon];

    // Get camera direction with recoil and accuracy applied
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);

    // Apply weapon accuracy (spread)
    const spread = (1 - config.accuracy) * 0.1;
    direction.x += (Math.random() - 0.5) * spread;
    direction.y += (Math.random() - 0.5) * spread;
    direction.z += (Math.random() - 0.5) * spread;
    direction.normalize();

    // Apply additional spread if moving or not aiming
    if (!this.aimingDownSights) {
      const additionalSpread = 0.05;
      direction.x += (Math.random() - 0.5) * additionalSpread;
      direction.y += (Math.random() - 0.5) * additionalSpread;
    }

    // Raycast to see what we hit
    const raycaster = new THREE.Raycaster(this.camera.position, direction);
    const intersects = raycaster.intersectObjects(targetObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0];

      // Create impact effect
      this.createImpactEffect(
        hit.point,
        hit.normal || new THREE.Vector3(0, 1, 0)
      );

      // Apply damage if hit object has health
      if (hit.object.userData.health !== undefined) {
        hit.object.userData.health -= config.damage;
        console.log(
          `Hit target for ${config.damage} damage. Health: ${hit.object.userData.health}`
        );

        if (hit.object.userData.health <= 0) {
          // Target destroyed
          this.scene.remove(hit.object);
        }
      }
    }

    // Create tracer effect for visual feedback
    this.createTracer(
      this.camera.position.clone(),
      intersects.length > 0
        ? intersects[0].point
        : this.camera.position
            .clone()
            .add(direction.multiplyScalar(config.range))
    );
  }

  /**
   * Create visual impact effect
   */
  private createImpactEffect(
    position: THREE.Vector3,
    normal: THREE.Vector3
  ): void {
    // Create spark particles
    const sparkGeometry = new THREE.SphereGeometry(0.02, 4, 4);
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    for (let i = 0; i < 5; i++) {
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
      spark.position.copy(position);

      // Random spark direction influenced by surface normal
      const sparkDir = normal.clone();
      sparkDir.x += (Math.random() - 0.5) * 2;
      sparkDir.y += Math.random();
      sparkDir.z += (Math.random() - 0.5) * 2;
      sparkDir.normalize();

      this.scene.add(spark);

      // Animate spark
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed > 500) {
          this.scene.remove(spark);
          return;
        }

        spark.position.add(sparkDir.clone().multiplyScalar(0.02));
        spark.material.opacity = 1 - elapsed / 500;
        requestAnimationFrame(animate);
      };
      animate();
    }
  }

  /**
   * Create bullet tracer effect
   */
  private createTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const tracerGeometry = new THREE.BufferGeometry().setFromPoints([
      start,
      end,
    ]);
    const tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xffff00,
      opacity: 0.8,
      transparent: true,
    });
    const tracer = new THREE.Line(tracerGeometry, tracerMaterial);

    this.scene.add(tracer);

    // Remove tracer after short time
    setTimeout(() => {
      this.scene.remove(tracer);
    }, 100);
  }

  /**
   * Trigger muzzle flash effect
   */
  private triggerMuzzleFlash(): void {
    if (!this.muzzleFlash) return;

    this.muzzleFlash.visible = true;
    this.muzzleFlash.intensity = 2;

    setTimeout(() => {
      if (this.muzzleFlash) {
        this.muzzleFlash.visible = false;
      }
    }, 50);
  }

  /**
   * Apply weapon recoil
   */
  private applyRecoil(): void {
    const config = WEAPON_CONFIGS[this.currentWeapon];
    const recoilAmount = config.recoil * (this.aimingDownSights ? 0.5 : 1.0);

    // Apply random recoil
    this.recoilOffset.x += (Math.random() - 0.5) * recoilAmount * 0.02;
    this.recoilOffset.y += Math.random() * recoilAmount * 0.03;

    // Limit maximum recoil
    this.recoilOffset.x = Math.max(-0.1, Math.min(0.1, this.recoilOffset.x));
    this.recoilOffset.y = Math.max(-0.05, Math.min(0.15, this.recoilOffset.y));
  }

  /**
   * Start weapon reload
   */
  startReload(): void {
    if (
      this.weaponState.isReloading ||
      this.weaponState.currentAmmo >=
        WEAPON_CONFIGS[this.currentWeapon].magazineSize
    ) {
      return;
    }

    this.weaponState.isReloading = true;
    this.weaponState.reloadStartTime = Date.now();

    console.log(`Reloading ${this.currentWeapon}...`);
  }

  /**
   * Set aiming down sights state
   */
  setAiming(aiming: boolean): void {
    this.aimingDownSights = aiming;

    if (this.weaponMesh) {
      // Move weapon closer to center when aiming
      const targetX = aiming ? 0.1 : 0.3;
      const targetY = aiming ? -0.1 : -0.2;

      this.weaponMesh.position.x = targetX;
      this.weaponMesh.position.y = targetY;
    }

    // Update crosshair
    if (this.crosshair) {
      this.crosshair.style.opacity = aiming ? "1" : "0.8";
      this.crosshair.style.transform = aiming
        ? "translate(-50%, -50%) scale(0.8)"
        : "translate(-50%, -50%) scale(1)";
    }
  }

  /**
   * Switch weapon
   */
  switchWeapon(weaponType: WeaponType): void {
    this.currentWeapon = weaponType;
    this.weaponState = {
      currentAmmo: WEAPON_CONFIGS[weaponType].magazineSize,
      isReloading: false,
      lastFireTime: 0,
      reloadStartTime: 0,
    };

    console.log(`Switched to ${weaponType}`);
  }

  /**
   * Update weapon system
   */
  update(deltaTime: number): void {
    // Handle reload completion
    if (this.weaponState.isReloading) {
      const reloadTime = WEAPON_CONFIGS[this.currentWeapon].reloadTime;
      if (Date.now() - this.weaponState.reloadStartTime >= reloadTime) {
        this.weaponState.isReloading = false;
        this.weaponState.currentAmmo =
          WEAPON_CONFIGS[this.currentWeapon].magazineSize;
        console.log(`${this.currentWeapon} reloaded!`);
      }
    }

    // Reduce recoil over time
    this.recoilOffset.x *= 0.9;
    this.recoilOffset.y *= 0.9;

    // Apply recoil to camera (this would be handled by the camera controller)
    // For now, we'll just track it in this system
  }

  /**
   * Get current weapon info for UI
   */
  getWeaponInfo() {
    return {
      weaponType: this.currentWeapon,
      currentAmmo: this.weaponState.currentAmmo,
      maxAmmo: WEAPON_CONFIGS[this.currentWeapon].magazineSize,
      isReloading: this.weaponState.isReloading,
      recoilOffset: this.recoilOffset.clone(),
    };
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.crosshair) {
      document.body.removeChild(this.crosshair);
    }

    if (this.weaponMesh) {
      this.camera.remove(this.weaponMesh);
    }

    if (this.muzzleFlash) {
      this.camera.remove(this.muzzleFlash);
    }
  }
}
