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
    private isFiring: boolean = false;

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

    public setFiring(isFiring: boolean) {
        this.isFiring = isFiring;
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
     * Start the reload process
     */
    startReload(): void {
        if (this.weaponState.isReloading) return;

        const config = WEAPON_CONFIGS[this.currentWeapon];
        if (this.weaponState.currentAmmo === config.magazineSize) return;

        this.weaponState.isReloading = true;
        this.weaponState.reloadStartTime = Date.now();
        console.log("Reloading...");

        // Play reload animation/sound here
    }

    /**
     * Update the weapon system state
     * @param deltaTime Time since last frame
     */
    update(deltaTime: number, objects: THREE.Object3D[]): void {
        if (this.isFiring) {
            this.fire(objects);
        }
        // Update reload state
        if (this.weaponState.isReloading) {
            const config = WEAPON_CONFIGS[this.currentWeapon];
            const reloadTime = config.reloadTime * 1000; // Convert to ms
            if (Date.now() - this.weaponState.reloadStartTime >= reloadTime) {
                this.finishReload();
            }
        }

        // Update recoil
        this.updateRecoil(deltaTime);

        // Update projectiles
        this.updateProjectiles(deltaTime);

        // Update UI
        this.updateUI();
    }

    /**
     * Finish the reload process
     */
    private finishReload(): void {
        const config = WEAPON_CONFIGS[this.currentWeapon];
        this.weaponState.currentAmmo = config.magazineSize;
        this.weaponState.isReloading = false;
        console.log("Reload complete.");
    }

    /**
     * Apply recoil to the camera
     */
    private applyRecoil(): void {
        const config = WEAPON_CONFIGS[this.currentWeapon];
        const recoilAmount = this.aimingDownSights
            ? config.recoil * 0.5
            : config.recoil;

        this.recoilOffset.y += recoilAmount;
        this.recoilOffset.x += (Math.random() - 0.5) * recoilAmount * 0.5;
    }

    /**
     * Update recoil recovery
     * @param deltaTime Time since last frame
     */
    private updateRecoil(deltaTime: number): void {
        // Recoil recovery logic
        this.recoilOffset.y -= deltaTime * 0.1;
        this.recoilOffset.y = Math.max(0, this.recoilOffset.y);
    }

    /**
     * Switch to a different weapon
     * @param weaponType The type of weapon to switch to
     */
    switchWeapon(weaponType: WeaponType): void {
        if (this.currentWeapon === weaponType) return;

        this.currentWeapon = weaponType;
        this.weaponState = {
            currentAmmo: WEAPON_CONFIGS[this.currentWeapon].magazineSize,
            isReloading: false,
            lastFireTime: 0,
            reloadStartTime: 0,
        };
        console.log(`Switched to ${weaponType}`);
    }
}
