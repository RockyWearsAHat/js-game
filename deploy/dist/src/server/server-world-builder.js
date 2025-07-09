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
exports.ServerWorldBuilder = void 0;
const THREE = __importStar(require("three"));
/**
 * Server-side World Builder
 *
 * Creates the game world geometry for server-side collision detection.
 * No rendering or client-side objects.
 */
class ServerWorldBuilder {
    constructor(scene) {
        this.scene = scene;
    }
    buildWorld() {
        const objects = [];
        // Ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        objects.push(ground);
        // Simple obstacles
        const boxGeometry = new THREE.BoxGeometry(5, 5, 5);
        const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const box1 = new THREE.Mesh(boxGeometry, boxMaterial);
        box1.position.set(10, 2.5, 0);
        box1.castShadow = true;
        box1.receiveShadow = true;
        this.scene.add(box1);
        objects.push(box1);
        const box2 = new THREE.Mesh(boxGeometry, boxMaterial);
        box2.position.set(-10, 2.5, 10);
        box2.castShadow = true;
        box2.receiveShadow = true;
        this.scene.add(box2);
        objects.push(box2);
        return objects;
    }
}
exports.ServerWorldBuilder = ServerWorldBuilder;
//# sourceMappingURL=server-world-builder.js.map