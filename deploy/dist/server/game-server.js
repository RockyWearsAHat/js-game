"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_game_1 = require("../src/server/server-game");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const serverGame = new server_game_1.ServerGame(PORT);
serverGame.start();
console.log(`Game server listening on port ${PORT}`);
//# sourceMappingURL=game-server.js.map