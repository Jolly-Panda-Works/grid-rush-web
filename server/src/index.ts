import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GridRushRoom } from './GridRushRoom';
import { museumRouter } from './museum';
import { accountsRouter } from './accounts';
import { socialRouter } from './social';
import { storyRouter } from './story';

const port = Number(process.env.PORT || 2567);
const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true, game: 'Grid Rush' }));
app.use('/museum', museumRouter());
app.use('/api', accountsRouter());
app.use('/api', socialRouter());
app.use('/api', storyRouter());

// Optional: serve the production client build (npm run build && npm start)
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) app.use(express.static(dist));

const httpServer = createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define('grid_rush', GridRushRoom);

gameServer.listen(port).then(() => {
  console.log(`[Grid Rush] server listening on http://localhost:${port}  (ws://localhost:${port})`);
});
