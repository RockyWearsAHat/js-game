"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const PORT = process.env.MATCHMAKING_PORT ? parseInt(process.env.MATCHMAKING_PORT) : 8081;
const wss = new ws_1.WebSocketServer({ port: PORT });
console.log(`Matchmaking server listening on port ${PORT}`);
wss.on('connection', (ws) => {
    console.log('Client connected to matchmaking server');
    // For now, just immediately assign the client to the game server
    ws.send(JSON.stringify({ type: 'assign', gameServer: `ws://localhost:${process.env.PORT || 8080}` }));
    ws.on('close', () => {
        console.log('Client disconnected from matchmaking server');
    });
});
//# sourceMappingURL=matchmaking-server.js.map