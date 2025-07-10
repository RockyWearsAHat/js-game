export type Vec3 = { x: number; y: number; z: number };
export type InputState = {
	forward: boolean; back: boolean; left: boolean; right: boolean;
	shoot: boolean; dir: Vec3;
};
export type WorldState = {
	type: 'world';
	players: { id: string; pos: Vec3; health: number }[];
	bullets: { pos: Vec3 }[];
};

export class NetworkClient {
	private ws!: WebSocket; // Adding the definite assignment assertion operator (!)
	private world: WorldState | null = null;
	private id = '';
	private reconnectTimer: number | null = null;
	private connected = false;

	constructor() {
		const isProd = import.meta.env.PROD;
		let url: string;
		if (isProd) {
			// production: wss://your-domain.com/ws/
			url = `wss://${window.location.host}/ws/`;
		} else {
			// development: ws://localhost:8080
			// url = 'ws://localhost:8080';
			url = `wss://${window.location.host}/ws/`;
		}
		this.connectToServer(url);
	}

	private connectToServer(url: string): void {
		console.log(`Connecting to game server at ${url}`);
		this.ws = new WebSocket(url);
		
		this.ws.addEventListener('open', () => {
			console.log('Connected to game server');
			this.connected = true;
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer);
				this.reconnectTimer = null;
			}
		});
		
		this.ws.addEventListener('message', evt => {
			const data = JSON.parse(evt.data as string);
			console.log('Received message from server:', data); // Added logging
			if (data.type === 'welcome') this.id = data.id;
			if (data.type === 'world')   this.world = data as WorldState;
		});
		
		this.ws.addEventListener('close', () => {
			console.log('Disconnected from server');
			this.connected = false;
			
			// Auto-reconnect with exponential backoff
			if (!this.reconnectTimer) {
				this.reconnectTimer = window.setTimeout(() => {
					console.log('Attempting to reconnect...');
					this.connectToServer(url);
				}, 3000);
			}
		});
		
		this.ws.addEventListener('error', (err) => {
			console.error('WebSocket error:', err);
		});
	}

	sendPlayerState(state: any) {
		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: 'playerState', payload: state }));
		}
	}

	sendInput(input: InputState) {
		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: 'input', payload: input }));
		}
	}

	getWorld(): WorldState | null { return this.world; }
	get playerId() { return this.id; } // expose for renderer
	isConnected(): boolean {
		return this.connected && this.ws.readyState === WebSocket.OPEN;
	}
}