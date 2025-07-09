import * as THREE from "three";

/**
 * Server-side World Builder
 *
 * Creates the game world geometry for server-side collision detection.
 * No rendering or client-side objects.
 */
export class ServerWorldBuilder {
  private scene: THREE.Scene;
  private collisionObjects: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  build(): void {
    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0xcccccc })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.collisionObjects.push(ground);

    // Simple obstacles
    const boxGeometry = new THREE.BoxGeometry(5, 5, 5);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    const box1 = new THREE.Mesh(boxGeometry, boxMaterial);
    box1.position.set(10, 2.5, 0);
    box1.castShadow = true;
    box1.receiveShadow = true;
    this.scene.add(box1);
    this.collisionObjects.push(box1);

    const box2 = new THREE.Mesh(boxGeometry, boxMaterial);
    box2.position.set(-10, 2.5, 10);
    box2.castShadow = true;
    box2.receiveShadow = true;
    this.scene.add(box2);
    this.collisionObjects.push(box2);
  }

  getCollisionObjects(): THREE.Object3D[] {
    return this.collisionObjects;
  }
}
