import * as THREE from "three";
import { Game } from "./core/game";

/**
 * Parkour 3D Game
 *
 * This file initializes the game and starts the game loop.
 * The game architecture is modular with separate systems for:
 * - Physics and collision detection
 * - Character controls and movement
 * - World building and obstacle course
 * - Input handling
 */

// Make game globally accessible for debugging
declare global {
  interface Window {
    game: Game;
    debugInfo: any;
    showActionPrompt: (text: string) => void;
    hideActionPrompt: () => void;
  }
}

// Initialize the game when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("DOM loaded, initializing game...");
    console.log("THREE.js version:", THREE.REVISION);

    // Create the game instance
    const container = document.body;
    console.log("Container element:", container);

    const game = new Game(container);
    console.log("Game instance created");

    // Make game globally available for debugging
    window.game = game;
    window.debugInfo = {
      sceneChildren: 0,
      objectsCount: 0,
      rendererExists: false,
      cameraExists: false,
    };

    // Start the game loop
    game.start();

    // Update debug info
    window.debugInfo.sceneChildren = game.scene.children.length;
    window.debugInfo.objectsCount = game.objects.length;
    window.debugInfo.rendererExists = !!game.renderer;
    window.debugInfo.cameraExists = !!game.camera;

    console.log("Game started successfully");
    console.log("Debug info:", window.debugInfo);

    // UI Controls
    const controls = document.getElementById("controls");
    const prompt = document.getElementById("prompt");
    const actionPrompt = document.getElementById("action-prompt");

    // Hide prompt on pointer lock
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement) {
        if (prompt) prompt.classList.add("hidden");
      } else {
        if (prompt) prompt.classList.remove("hidden");
      }
    });

    // Toggle controls visibility with H key
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "h") {
        if (controls) controls.classList.toggle("hidden");
      }
    });

    // Expose functions for action prompts
    window.showActionPrompt = (text) => {
      if (actionPrompt) {
        actionPrompt.textContent = text;
        actionPrompt.classList.add("active");
      }
    };

    window.hideActionPrompt = () => {
      if (actionPrompt) {
        actionPrompt.classList.remove("active");
      }
    };
  } catch (error) {
    console.error("ERROR INITIALIZING GAME:", error);
  }
});
