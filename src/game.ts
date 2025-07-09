import * as THREE from 'three';
import { NetworkClient, InputState } from './network/client';

// networking ------------------------------------------------
const net = new NetworkClient();

// caches ----------------------------------------------------
const playerMeshes = new Map<string, THREE.Mesh>();
// helper to colour local player
function makePlayerMesh(isLocal = false) {
	const mat = new THREE.MeshStandardMaterial({ color: isLocal ? 0xff0000 : 0x0000ff });
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat);
	mesh.castShadow = true;
	return mesh;
}

// integrate into your render loop
function animate() {
	requestAnimationFrame(animate);

	// 1. gather input
	const inp: InputState = {
		forward: keyW, back: keyS, left: keyA, right: keyD,
		shoot: mouseClicked,
		dir: getCameraDirection()			// <- existing helper
	};
	net.sendInput(inp);

	// 2. apply server state to meshes
	const world = net.getWorld();
	if (world) {
		// add / update meshes ---------------------------------
		const seen = new Set<string>();
		for (const remote of world.players) {
			seen.add(remote.id);
			let mesh = playerMeshes.get(remote.id);
			if (!mesh) {
				const isLocal = remote.id === net.playerId;
				mesh = makePlayerMesh(isLocal);
				playerMeshes.set(remote.id, mesh);
				scene.add(mesh);
			}
			mesh.position.set(remote.pos.x, remote.pos.y, remote.pos.z);
		}
		// remove disconnected players -------------------------
		for (const id of playerMeshes.keys()) {
			if (!seen.has(id)) {
				scene.remove(playerMeshes.get(id)!);
				playerMeshes.delete(id);
			}
		}
		// bullets
		updateBulletMeshes(world.bullets);	// ...existing helper...
	}

	// final draw
	renderer.render(scene, camera);
}
animate();

// ambient declarations -------------------------------------
declare const keyW: boolean, keyS: boolean, keyA: boolean, keyD: boolean;
declare let mouseClicked: boolean;
declare function getCameraDirection(): { x: number; y: number; z: number };
declare const scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.Camera;
declare function updateBulletMeshes(
	bullets: { pos: { x: number; y: number; z: number } }[]
): void;