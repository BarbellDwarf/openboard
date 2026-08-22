// Local test boot: adapter-node handler + Socket.IO from build outputs.
import http from 'node:http';
import { Server } from 'socket.io';
const { handler } = await import('./build/handler.js');
const { injectSocketIO, startBackgroundJobs } = await import('./build/realtime.mjs');
const port = Number(process.env.PORT ?? 3100);
const httpServer = http.createServer(handler);
const io = new Server(httpServer, {
	connectionStateRecovery: { maxDisconnectionDuration: 60_000 }
});
injectSocketIO(io);
startBackgroundJobs();
httpServer.listen(port, '0.0.0.0', () => console.log(`OpenBoard listening on ${port}`));
process.on('SIGTERM', () => {
	io.close();
	httpServer.close(() => process.exit(0));
});
