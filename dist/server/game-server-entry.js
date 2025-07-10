"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_game_1 = require("./server-game");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
new server_game_1.ServerGame(PORT);
