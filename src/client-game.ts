import * as THREE from "three";
import { Game } from "./core/game";
import { CharacterController } from "./controllers/character-controller";
import { InputManager } from "./utils/input-manager";
import { WeaponSystem } from "./systems/weapon-system";
import { WorldBuilder } from "./world/world-builder";
import { NetworkManager } from "./network/network-manager";
import { PlayerState } from "./core/types";

const { WebGLRenderer, PCFSoftShadowMap, ACESFilmicToneMapping, SRGBColorSpace } = THREE;

export class ClientGame extends Game {
    public camera: THREE.PerspectiveCamera;
    public renderer!: THREE.WebGLRenderer;
    private characterController!: CharacterController;
    private inputManager!: InputManager;
    private weaponSystem!: WeaponSystem;
    private worldBuilder!: WorldBuilder;
    private remotePlayers: Map<string, THREE.Mesh> = new Map();
    private helpMenu!: HTMLElement;


    constructor(container: HTMLElement) {
        super();
        console.log("ClientGame constructor called");

        this.scene.background = new THREE.Color(0x87ceeb); // Set a sky-blue background

        // Add a hemisphere light to ensure the scene is lit
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        hemisphereLight.position.set(0, 1, 0);
        this.scene.add(hemisphereLight);

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 2, 5);

        this.setupRenderer(container);
        this.inputManager = new InputManager(this.renderer.domElement);
        this.worldBuilder = new WorldBuilder(this.scene);
        this.characterController = new CharacterController(this.camera, true);
        this.weaponSystem = new WeaponSystem(this.scene, this.camera);

        const networkManager = new NetworkManager();
        this.setNetwork(networkManager);
        this.setupNetworkEvents(networkManager);


        window.addEventListener("resize", this.onWindowResize.bind(this));

        this.buildWorld();
        this.createWeaponUI();
        this.setupActionPrompts();
        this.setupHelpMenu();

        (window as any).game = this;
    }

    private setupHelpMenu(): void {
        this.helpMenu = document.getElementById("help-menu")!;
        this.inputManager.on("keydown", (event: KeyboardEvent) => {
            if (event.code === "KeyH") {
                this.toggleHelpMenu();
            }
        });
    }

    private toggleHelpMenu(): void {
        this.helpMenu.classList.toggle("hidden");
        const isHidden = this.helpMenu.classList.contains("hidden");
        if (isHidden) {
            this.inputManager.unlockPointer();
        } else {
            this.inputManager.lockPointer();
        }
    }

    private setupNetworkEvents(networkManager: NetworkManager) {
        networkManager.setOnInit(data => {
            console.log('INIT', data);
            if (data.players.length > 0) {
                const myPlayerState = data.players.find(p => p.id === networkManager.getPlayerId());
                if (myPlayerState) {
                    this.characterController.setInitialPosition(myPlayerState.position);
                }
            }
            data.players.forEach(p => this.addPlayer(p.id, p));
        });

        networkManager.setOnPlayerConnected(player => {
            this.addPlayer(player.id, player);
        });

        networkManager.setOnPlayerDisconnected(playerId => {
            this.removePlayer(playerId);
        });

        networkManager.setOnGameStateUpdate(players => {
            players.forEach(p => {
                if (p.id !== networkManager.getPlayerId()) {
                    this.updatePlayerState(p.id, p);
                }
            });
        });
    }

    addPlayer(id: string, state: PlayerState): void {
        super.addPlayer(id, state);

        if (id === this.network.getPlayerId()) {
            // This is the local player, don't create a mesh
            return;
        }

        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const playerMesh = new THREE.Mesh(geometry, material);
        playerMesh.position.set(state.position.x, state.position.y, state.position.z);
        this.scene.add(playerMesh);
        this.remotePlayers.set(id, playerMesh);
    }

    removePlayer(id: string): void {
        super.removePlayer(id);
        const playerMesh = this.remotePlayers.get(id);
        if (playerMesh) {
            this.scene.remove(playerMesh);
            this.remotePlayers.delete(id);
        }
    }

    updatePlayerState(id: string, state: PlayerState): void {
        super.updatePlayerState(id, state);
        const playerMesh = this.remotePlayers.get(id);
        if (playerMesh) {
            playerMesh.position.lerp(state.position, 0.1);
            // Here you could also update rotation if the state includes it
            if (state.yaw) {
                playerMesh.rotation.y = state.yaw;
            }
        }
    }


    private setupRenderer(container: HTMLElement): void {
        try {
            this.renderer = new WebGLRenderer({ antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = PCFSoftShadowMap;
            this.renderer.toneMapping = ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.2;
            this.renderer.outputColorSpace = SRGBColorSpace;
            container.appendChild(this.renderer.domElement);

        } catch (error) {
            console.error("Error setting up renderer:", error);
        }
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private buildWorld(): void {
        this.objects = this.worldBuilder.buildWorld();
    }

    private createWeaponUI(): void {
        const existingUI = document.getElementById("weapon-ui");
        if (existingUI) existingUI.remove();
        const existingControls = document.getElementById("controls-ui");
        if (existingControls) existingControls.remove();

        const ui = document.createElement("div");
        ui.id = "weapon-ui";
        ui.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: rgba(0,0,0,0.7); color: white; padding: 15px;
            border-radius: 5px; font-family: monospace; font-size: 14px;
            pointer-events: none; z-index: 1000;
        `;
        document.body.appendChild(ui);

        const controls = document.createElement("div");
        controls.id = "controls-ui";
        controls.style.cssText = `
            position: fixed; top: 20px; left: 20px;
            background: rgba(0,0,0,0.7); color: white; padding: 15px;
            border-radius: 5px; font-family: monospace; font-size: 12px;
            pointer-events: none; z-index: 1000;
        `;
        controls.innerHTML = `
            <div><strong>CONTROLS:</strong></div>
            <div>WASD: Move</div> <div>Mouse: Look</div> <div>Space: Jump</div>
            <div>Shift: Sprint</div> <div>C: Crouch</div> <div>Left Click: Fire</div>
            <div>Right Click: Aim</div> <div>R: Reload</div> <div>1-4: Switch Weapons</div>
        `;
        document.body.appendChild(controls);
    }

    private setupActionPrompts(): void {
        (window as any).showActionPrompt = (message: string) => {
            const prompt = document.getElementById("action-prompt");
            if (prompt) {
                prompt.textContent = message;
                prompt.classList.add("active");
            }
        };
        (window as any).hideActionPrompt = () => {
            const prompt = document.getElementById("action-prompt");
            if (prompt) prompt.classList.remove("active");
        };
    }

    public update(deltaTime: number): void {
        super.update(deltaTime);

        if (!this.helpMenu || this.helpMenu.classList.contains("hidden")) {
            const inputState = this.inputManager.getState();
            const mouseDelta = this.inputManager.getMouseDelta();
            this.characterController.handleMouseMove(mouseDelta.dx, mouseDelta.dy);

            const inputDirection = new THREE.Vector3(
                (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0),
                0,
                (inputState.backward ? 1 : 0) - (inputState.forward ? 1 : 0)
            );

            this.characterController.update(
                deltaTime,
                this.objects,
                inputDirection,
                inputState.jump,
                inputState.crouch,
                inputState.sprint
            );

            if (inputState.reset) {
                this.characterController.reset();
            }

            this.weaponSystem.update(deltaTime, this.objects);

            this.sendPlayerState();
        }

        this.renderer.render(this.scene, this.camera);
    }

    private sendPlayerState() {
        if (this.network && this.network.isConnected()) {
            const playerState = this.characterController.getState();
            this.network.sendPlayerState({
                position: playerState.position,
                yaw: playerState.yaw,
            });
        }
    }

    protected gameLoop(): void {
        super.gameLoop();
        requestAnimationFrame(this.gameLoop.bind(this));
    }


    public getCharacterController(): CharacterController {
        return this.characterController;
    }
}
