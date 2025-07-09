import * as dotenv from 'dotenv';
dotenv.config();

export const ServerConfig = {
    // Use environment variables with fallbacks
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    // Use 0.0.0.0 to bind to all interfaces on the server
    host: process.env.HOST || '0.0.0.0',
    // For production, increase ping interval to detect disconnects
    pingInterval: process.env.NODE_ENV === 'production' ? 30000 : 10000,
    // Maximum clients per server instance
    maxClients: process.env.MAX_CLIENTS ? parseInt(process.env.MAX_CLIENTS) : 100,
    // Serve static files
    serveStatic: process.env.SERVE_STATIC === 'true',
};
