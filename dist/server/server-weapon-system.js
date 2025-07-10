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
exports.ServerWeaponSystem = void 0;
const THREE = __importStar(require("three"));
const config_1 = require("../core/config");
/**
 * Server-side Weapon System - handles weapons, shooting, and projectiles authoritatively
 */
class ServerWeaponSystem {
    constructor(sceneObjects) {
        this.sceneObjects = sceneObjects;
    }
    /**
     * Server-side fire logic
     * @param weaponType The type of weapon being fired
     * @param fireOrigin The position from which the shot originates (e.g., player's camera position)
     * @param fireDirection The direction of the shot (e.g., player's camera forward vector)
     * @returns An object containing hit information (if any)
     */
    fire(fireOrigin, fireDirection, weaponType, _shooterId) {
        const config = config_1.WEAPON_CONFIGS[weaponType];
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
}
exports.ServerWeaponSystem = ServerWeaponSystem;
