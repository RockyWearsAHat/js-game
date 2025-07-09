import * as THREE from "three";

/**
 * World Builder
 *
 * Creates and manages the parkour obstacle course environment
 */
export class WorldBuilder {
  scene: THREE.Scene;
  objects: THREE.Object3D[] = [];
  textures: Record<string, THREE.Texture> = {};

  /**
   * Create a new world builder
   */
  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Add an immediately visible object to test rendering
    console.log("DEBUG: Adding test cube to scene to verify rendering");
    const testGeometry = new THREE.BoxGeometry(10, 10, 10);
    const testMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const testCube = new THREE.Mesh(testGeometry, testMaterial);
    testCube.position.set(0, 5, -15);
    this.scene.add(testCube);
    console.log("DEBUG: Test cube added to scene");

    this.loadTextures();
  }

  /**
   * Load all necessary textures
   */
  loadTextures(): void {
    // Instead of loading actual textures, we'll create colored materials
    // This avoids the need for texture files while developing

    const colors: Record<string, number> = {
      floor: 0x808080, // Gray
      wall: 0xdddddd, // Light gray
      metal: 0x888888, // Medium gray
      concrete: 0x999999, // Another gray
      wood: 0x8b4513, // Brown
      grass: 0x228b22, // Forest green
      gravel: 0x696969, // Dim gray
      brick: 0xb22222, // Firebrick red
    };

    // Create a simple texture for each material
    const textureLoader = new THREE.TextureLoader();

    Object.entries(colors).forEach(([name, color]) => {
      // Create a basic procedural texture (1x1 pixel of the specified color)
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
        ctx.fillRect(0, 0, 1, 1);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        this.textures[name] = texture;
      }
    });
  }

  /**
   * Build the entire world with all obstacles and platforms
   */
  buildWorld(): THREE.Object3D[] {
    console.log("DEBUG: WorldBuilder.buildWorld() called");

    // Clear existing objects
    this.objects = [];
    console.log("DEBUG: Objects array cleared");

    // Check if the scene exists
    if (!this.scene) {
      console.error(
        "DEBUG: CRITICAL ERROR - Scene is null or undefined in WorldBuilder"
      );
      return [];
    }

    console.log("Initial scene children count:", this.scene.children.length);

    // Add lighting
    try {
      this.setupLighting();
      console.log("Lighting set up");
    } catch (error) {
      console.error("Failed to set up lighting:", error);
    }

    // Add the floor and basic environment
    try {
      this.createEnvironment();
      console.log("Environment created");
    } catch (error) {
      console.error("Failed to create environment:", error);
    }

    // Build the obstacle course
    try {
      this.buildObstacleCourse();
      console.log("Obstacle course built");
    } catch (error) {
      console.error("Failed to build obstacle course:", error);
    }

    console.log(
      "World built successfully with",
      this.objects.length,
      "objects"
    );
    return this.objects;
  }

  /**
   * Setup lighting for the scene
   */
  setupLighting(): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    // Main directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;

    // Configure shadow properties for better quality
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;

    this.scene.add(directionalLight);

    // Add some hemisphere light for more natural lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3d3d3d, 0.6);
    this.scene.add(hemisphereLight);
  }

  /**
   * Create the basic environment (ground, walls, etc)
   */
  createEnvironment(): void {
    // Create a large ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.2,
    });

    if (this.textures.floor) {
      this.textures.floor.repeat.set(20, 20);
      groundMaterial.map = this.textures.floor;
    }

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    ground.castShadow = false;

    // Add to scene and objects array
    this.scene.add(ground);
    this.objects.push(ground);

    // Add surrounding walls
    const wallHeight = 10;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xa0a0a0,
      roughness: 0.7,
      metalness: 0.1,
    });

    if (this.textures.wall) {
      this.textures.wall.repeat.set(10, 3);
      wallMaterial.map = this.textures.wall;
    }

    // North wall
    const northWall = new THREE.Mesh(
      new THREE.BoxGeometry(100, wallHeight, 1),
      wallMaterial
    );
    northWall.position.set(0, wallHeight / 2, -50);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    this.scene.add(northWall);
    this.objects.push(northWall);

    // South wall
    const southWall = new THREE.Mesh(
      new THREE.BoxGeometry(100, wallHeight, 1),
      wallMaterial
    );
    southWall.position.set(0, wallHeight / 2, 50);
    southWall.castShadow = true;
    southWall.receiveShadow = true;
    this.scene.add(southWall);
    this.objects.push(southWall);

    // East wall
    const eastWall = new THREE.Mesh(
      new THREE.BoxGeometry(1, wallHeight, 100),
      wallMaterial
    );
    eastWall.position.set(50, wallHeight / 2, 0);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    this.scene.add(eastWall);
    this.objects.push(eastWall);

    // West wall
    const westWall = new THREE.Mesh(
      new THREE.BoxGeometry(1, wallHeight, 100),
      wallMaterial
    );
    westWall.position.set(-50, wallHeight / 2, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    this.scene.add(westWall);
    this.objects.push(westWall);

    // Add shooting targets
    this.createShootingTargets();
  }

  /**
   * Create shooting targets for weapon practice
   */
  createShootingTargets(): void {
    const targetPositions = [
      { x: -20, y: 3, z: -45 },
      { x: 0, y: 4, z: -45 },
      { x: 20, y: 2.5, z: -45 },
      { x: -30, y: 3.5, z: -30 },
      { x: 30, y: 2, z: -30 },
    ];

    targetPositions.forEach((pos, index) => {
      // Create target base
      const baseGeometry = new THREE.CylinderGeometry(0.5, 0.8, 0.2, 8);
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      base.position.set(pos.x, 0.1, pos.z);
      base.castShadow = true;
      base.receiveShadow = true;
      this.scene.add(base);
      this.objects.push(base);

      // Create target pole
      const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, pos.y, 8);
      const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(pos.x, pos.y / 2, pos.z);
      pole.castShadow = true;
      this.scene.add(pole);
      this.objects.push(pole);

      // Create target disk (rotated to be upright)
      const targetGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 16);
      const targetMaterial = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xff4444 : 0x4444ff,
      });
      const target = new THREE.Mesh(targetGeometry, targetMaterial);
      target.position.set(pos.x, pos.y, pos.z);
      target.rotation.x = Math.PI / 2; // Rotate 90 degrees to make it upright
      target.castShadow = true;
      target.receiveShadow = true;

      // Add health to target for shooting
      target.userData.health = 100;
      target.userData.isTarget = true;
      target.userData.originalColor = targetMaterial.color.clone();

      this.scene.add(target);
      this.objects.push(target);
    });
  }

  /**
   * Build the parkour obstacle course
   */
  buildObstacleCourse(): void {
    // Create a starting platform
    this.createPlatform(-20, 0.5, 0, 10, 1, 10);

    // Create a series of stepping platforms of increasing height
    this.createPlatform(-15, 0.5, -10, 2, 1, 2);
    this.createPlatform(-10, 1.0, -10, 2, 2, 2);
    this.createPlatform(-5, 1.5, -10, 2, 3, 2);
    this.createPlatform(0, 2.0, -10, 2, 4, 2);
    this.createPlatform(5, 2.5, -10, 2, 5, 2);

    // Create a higher platform to jump to
    this.createPlatform(10, 3, -5, 8, 0.5, 8);

    // Create some walls to navigate around
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    if (this.textures.brick) {
      this.textures.brick.repeat.set(2, 2);
      wallMaterial.map = this.textures.brick;
    }

    // Create a wall with a gap to mantle through
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 1), wallMaterial);
    wall1.position.set(10, 5.5, 0);
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    this.scene.add(wall1);
    this.objects.push(wall1);

    // Create a ledge to grab
    this.createPlatform(10, 5, 3, 8, 0.5, 2);

    // Create a small step to test step-up functionality
    this.createPlatform(-15, 0.25, 10, 6, 0.5, 6);
    this.createPlatform(-15, 0.5, 5, 6, 1, 2);

    // Create a series of walls for parkour wall runs
    for (let i = 0; i < 5; i++) {
      const wallRun = new THREE.Mesh(
        new THREE.BoxGeometry(1, 4, 3),
        wallMaterial
      );
      wallRun.position.set(20 + i * 3, 2, 10);
      wallRun.castShadow = true;
      wallRun.receiveShadow = true;
      this.scene.add(wallRun);
      this.objects.push(wallRun);
    }

    // Create a ramp for testing slope physics
    this.createRamp(0, 0, 15, 10, 3, 8, 20);

    // Create some movable objects
    this.createMovableBox(5, 1, 20, 1, 2, 1);
    this.createMovableBox(8, 1, 20, 1, 2, 1);
    this.createMovableBox(11, 1, 20, 1, 2, 1);
  }

  /**
   * Create a platform with the given dimensions and position
   */
  createPlatform(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.2,
    });

    if (this.textures.concrete) {
      this.textures.concrete.repeat.set(width / 2, depth / 2);
      material.map = this.textures.concrete;
    }

    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y + height / 2, z);
    platform.castShadow = true;
    platform.receiveShadow = true;

    this.scene.add(platform);
    this.objects.push(platform);

    return platform;
  }

  /**
   * Create a ramp with the given dimensions and position
   */
  createRamp(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    angle: number
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x909090,
      roughness: 0.9,
      metalness: 0.1,
    });

    if (this.textures.concrete) {
      this.textures.concrete.repeat.set(width / 2, depth / 2);
      material.map = this.textures.concrete;
    }

    const ramp = new THREE.Mesh(geometry, material);

    // Position the ramp
    ramp.position.set(
      x,
      y + (Math.sin((angle * Math.PI) / 180) * depth) / 2,
      z
    );

    // Rotate the ramp by the specified angle
    ramp.rotation.x = (angle * Math.PI) / 180;

    ramp.castShadow = true;
    ramp.receiveShadow = true;

    this.scene.add(ramp);
    this.objects.push(ramp);

    return ramp;
  }

  /**
   * Create a movable box that can be pushed by the player
   */
  createMovableBox(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0xa52a2a, // Brown color for crates
      roughness: 0.7,
      metalness: 0.1,
    });

    if (this.textures.wood) {
      material.map = this.textures.wood;
    }

    const box = new THREE.Mesh(geometry, material);
    box.position.set(x, y + height / 2, z);
    box.castShadow = true;
    box.receiveShadow = true;

    // Mark as a movable object with physics properties
    box.userData = {
      isMovable: true,
      mass: 10,
      friction: 0.8,
      restitution: 0.2,
    };

    this.scene.add(box);
    this.objects.push(box);

    return box;
  }
}
