import { ServerGame } from './server-game';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

new ServerGame(PORT);
