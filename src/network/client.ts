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

	constructor(url = this.getServerUrl()) {
		this.connectToServer(url);
	}

	private getServerUrl(): string {
		// In production, use the EC2 IP or domain name
		const serverHost = window.location.hostname;
		
		// If we're connecting from localhost, use the EC2 IP
		if (serverHost === 'localhost' || serverHost === '127.0.0.1') {
			return 'ws://44.250.70.176:8080';
		}
		
		// Otherwise use the same hostname where the page is hosted
		const serverPort = '8080';
		const protocol = 'ws';
		
		return `${protocol}://${serverHost}:${serverPort}`;
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