import * as THREE from 'three';

// ---------- types -------------------------------------------------
export interface PlayerState {
  id: string;
  position: { x: number; y: number; z: number };
  yaw?: number;
  health?: number;
}
type InitMsg = { playerId: string; players: PlayerState[] };
type PlayerPatch = { id: string; position: { x: number; y: number; z: number }; yaw?: number };
// ------------------------------------------------------------------

export class NetworkManager {
  private ws: WebSocket | null = null;
  private playerId: string | null = null;

  // callbacks
  private onInit: ((msg: InitMsg) => void) | null = null;
  private onGameStateUpdate: ((state: PlayerState[]) => void) | null = null;
  private onPlayerConnected: ((player: PlayerState) => void) | null = null;
  private onPlayerDisconnected: ((id: string) => void) | null = null;
  private onHit: ((h: string, p: THREE.Vector3, n: THREE.Vector3, t: string, d: number) => void) | null = null;
  private onPlayerStateUpdate: ((p: PlayerPatch) => void) | null = null;
  private debug = false;                       // off by default

  constructor(url?: string) {
    // build default URL from current page – works with `vite --host`
    if (!url) {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const host  = location.hostname;
      const port  = 8080;                        // keep in sync with server
      url = `${proto}://${host}:${port}`;
    }
    this.connect(url);
  }

  // ---------------- connection ------------------------------------
  private connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen  = () => this.debug && console.log("[ws] open");
    this.ws.onclose = () => this.debug && console.log("[ws] closed");
    this.ws.onerror = e  => console.error("WS error:", e);

    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data as string);
      if (this.debug) console.log("[ws←]", msg.type, msg);
      switch (msg.type) {
        case "init":
          this.playerId = msg.playerId;
          this.onInit?.(msg as InitMsg);
          break;
        case "gameState":
          this.onGameStateUpdate?.(msg.players as PlayerState[]);
          break;
        case "playerState":        // ← single-player incremental
        case "playerStateUpdate":  // ← keep both names
          this.onPlayerStateUpdate?.(msg as PlayerPatch);
          break;
        case "playerConnected":
          this.onPlayerConnected?.(msg.player as PlayerState);
          break;
        case "playerDisconnected":
          this.onPlayerDisconnected?.(msg.playerId);
          break;
        case "hit":
          this.onHit?.(msg.hitterId, msg.hitPoint, msg.hitNormal, msg.targetId, msg.damage);
          break;
      }
    };
  }

  /** enable verbose WS logging from console:  game.network.setDebug(true) */
  setDebug(flag = true) { this.debug = flag; }

  // ---------------- public API ------------------------------------
  /** send one input tick to the authoritative server */
  public sendInput(
    dir: THREE.Vector3,
    jump: boolean,
    crouch: boolean,
    sprint: boolean,
    fire: boolean,
    viewDir: THREE.Vector3
  ) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    const packet = {
      type: "input",
      inputDirection: { x: dir.x, y: dir.y, z: dir.z },
      isJumpPressed: jump,
      isCrouchPressed: crouch,
      isSprintPressed: sprint,
      isFirePressed: fire,
      fireDirection: { x: viewDir.x, y: viewDir.y, z: viewDir.z },
    };

    if (this.debug) console.log("[ws→] input", packet);
    this.ws!.send(JSON.stringify(packet));
  }

  public sendResetPosition() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'resetPosition' }));
    }
  }

  /** 
   * broadcast current local transform to the server AFTER collision is resolved
   * Make sure this is called after collision detection completes
   */
  public sendPlayerState(pos: THREE.Vector3, yaw = 0) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    
    // Send fully collision-checked position to server
    const packet = {
      type: "playerState",
      id:   this.playerId,
      position: { x: pos.x, y: pos.y, z: pos.z },
      yaw
    };
    if (this.debug) console.log("[ws→] playerState", packet);
    this.ws.send(JSON.stringify(packet));
  }

  // -------- callback setters -----------
  setOnInit(cb: (msg: InitMsg) => void) { this.onInit = cb; }
  setOnGameStateUpdate(cb: (s: PlayerState[]) => void) { this.onGameStateUpdate = cb; }
  setOnPlayerConnected(cb: (p: PlayerState) => void) { this.onPlayerConnected = cb; }
  setOnPlayerDisconnected(cb: (id: string) => void) { this.onPlayerDisconnected = cb; }
  setOnHit(cb: (h: string, p: THREE.Vector3, n: THREE.Vector3, t: string, d: number) => void) { this.onHit = cb; }
  /* register per-player incremental updates */
  setOnPlayerStateUpdate(cb: (p: PlayerPatch) => void) { this.onPlayerStateUpdate = cb; }

  // -------- utilities ------------------
  getPlayerId() { return this.playerId; }
}