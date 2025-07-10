"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameConfig = exports.WEAPON_CONFIGS = exports.WeaponType = void 0;
// Weapon types
var WeaponType;
(function (WeaponType) {
    WeaponType["ASSAULT_RIFLE"] = "assault_rifle";
    WeaponType["PISTOL"] = "pistol";
    WeaponType["SNIPER"] = "sniper";
    WeaponType["SMG"] = "smg";
})(WeaponType || (exports.WeaponType = WeaponType = {}));
exports.WEAPON_CONFIGS = {
    [WeaponType.ASSAULT_RIFLE]: {
        damage: 25,
        range: 500,
        fireRate: 600,
        magazineSize: 30,
        reloadTime: 2500,
        accuracy: 0.8,
        recoil: 0.3,
    },
    [WeaponType.PISTOL]: {
        damage: 15,
        range: 200,
        fireRate: 300,
        magazineSize: 12,
        reloadTime: 1500,
        accuracy: 0.9,
        recoil: 0.1,
    },
    [WeaponType.SNIPER]: {
        damage: 100,
        range: 1000,
        fireRate: 40,
        magazineSize: 5,
        reloadTime: 4000,
        accuracy: 0.98,
        recoil: 0.8,
    },
    [WeaponType.SMG]: {
        damage: 18,
        range: 150,
        fireRate: 900,
        magazineSize: 25,
        reloadTime: 2000,
        accuracy: 0.7,
        recoil: 0.2,
    },
};
exports.GameConfig = {
    player: {
        jumpForce: 16,
        walkSpeed: 5,
        sprintSpeed: 8,
        crouchSpeed: 3,
        airControl: 0.5,
    },
};
