# Parkour 3D Game Features

## ✅ Completed Features

### Core Game Engine

- **Three.js 3D rendering** with proper lighting and shadows
- **Electron desktop app** with both dev and production modes
- **TypeScript compilation** with proper module structure
- **Vite dev server** with hot reload support
- **Modular architecture** with separate systems for different functionality

### Camera System

- **Fixed camera rotation** - locked to 2 axes only (no roll/sideways flipping)
  - Yaw (left/right rotation) ✅
  - Pitch (up/down rotation) with clamping ✅
  - No roll rotation ✅
- **Pitch clamping** to prevent camera flipping upside down
- **Pointer lock** for immersive first-person controls

### Movement System

- **Walking/Running** with configurable speeds
- **Sprinting** with FOV changes for visual feedback
- **Crouching** with height and speed adjustments
- **Jumping** with proper physics and momentum preservation
- **Air control** for mid-air movement adjustments
- **Ground friction** to prevent slippery movement
- **Step-up detection** for stairs and small obstacles

### Parkour Mechanics

- **Ledge Grabbing** - automatically grab onto ledges when falling
- **Mantling** - climb up onto grabbed ledges with smooth animation
- **Wall Running** - run along vertical walls with proper physics
  - Automatic wall detection
  - Gravity reduction during wall run
  - Wall jumping to escape
  - Timer-based duration limit
  - Smooth transitions in/out of wall running

### World Building

- **Procedural level generation** with platforms and obstacles
- **Collision detection** using optimized capsule-based system
- **Material system** with proper textures and lighting
- **Multiple platform types** for varied parkour challenges

### Input System

- **WASD movement** with full 8-directional support
- **Mouse look** with configurable sensitivity
- **Space to jump**
- **Shift to sprint**
- **Ctrl/C to crouch**
- **R to reset position**
- **Escape to exit pointer lock**

## 🎮 How to Play

### Development Mode

```bash
npm run dev
```

- Runs Vite dev server on http://localhost:5173
- TypeScript compilation in watch mode
- Electron app with hot reload
- DevTools available for debugging

### Production Mode

```bash
npm run build && npm start
```

- Builds optimized production bundle
- Runs Electron app from built files
- Same functionality as dev mode

### Controls

- **Move**: WASD or Arrow Keys
- **Look**: Mouse (click to lock pointer)
- **Jump**: Space
- **Sprint**: Shift (hold)
- **Crouch**: Ctrl or C
- **Reset Position**: R
- **Exit Pointer Lock**: Escape

### Parkour Moves

1. **Jump** onto platforms and over gaps
2. **Sprint** for longer jumps and momentum
3. **Ledge Grab** - fall near a ledge edge to automatically grab it
4. **Mantle** - press jump while grabbing a ledge to climb up
5. **Wall Run** - run toward a vertical wall while moving to start wall running
6. **Wall Jump** - press jump while wall running to jump away from the wall

## 🏗️ Architecture

### File Structure

```
src/
├── core/
│   ├── game.ts          # Main game class and loop
│   └── types.ts         # Type definitions
├── controllers/
│   └── character-controller.ts  # Player movement and parkour
├── physics/
│   ├── collision.ts     # Collision detection system
│   └── physics.ts       # Physics calculations
├── utils/
│   └── input-manager.ts # Input handling and pointer lock
├── world/
│   └── world-builder.ts # Level generation
├── preload.ts          # Electron preload script
└── renderer.ts         # Main renderer entry point
```

### Key Systems

- **Game Loop**: Manages update/render cycles and coordinates all systems
- **Character Controller**: Handles all player movement, physics, and parkour mechanics
- **Collision System**: Optimized capsule-based collision detection
- **Input Manager**: Centralized input handling with pointer lock management
- **World Builder**: Creates the 3D environment with platforms and obstacles

## 🔧 Technical Details

### Camera Rotation Fix

The camera rotation has been fixed to prevent the nauseating sideways rolling that was occurring:

- Only pitch (x-axis) and yaw (y-axis) rotation are allowed
- Roll (z-axis) is explicitly locked to 0
- Pitch is clamped to prevent camera flipping
- Smooth mouse input with configurable sensitivity

### Wall Running Physics

- Detects walls in 4 directions (forward, backward, left, right)
- Requires vertical walls (slope check) to prevent running on floors/ceilings
- Applies reduced gravity during wall run
- Maintains forward momentum along the wall surface
- Automatic termination on timer expiry, input loss, or landing

### Performance Optimizations

- Efficient collision detection with early exit conditions
- Optimized raycasting for parkour mechanics
- Proper cleanup of Three.js resources
- Modular code structure for maintainability

## 🚀 Future Enhancements

Potential additions for further development:

- More complex parkour moves (wall jumps at angles, sliding)
- Multiple levels or procedural level generation
- Sound effects and background music
- Visual effects for parkour moves
- Performance metrics and speedrun timing
- Mobile/touch controls
- Multiplayer support
