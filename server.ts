import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/apiRouter';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use('/images', express.static(path.join(process.cwd(), 'PravahDridh/frontend/public/images')));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'PravahDridh Intelligence Server' });
  });

  // REST API Routes
  app.use('/api/v1', apiRouter);

  // WebSocket Server for live risk stream at /api/v1/risk/ws
  const wss = new WebSocketServer({ server, path: '/api/v1/risk/ws' });

  wss.on('connection', (ws: WebSocket) => {
    // Send immediate initial sync payload
    const initialPayload = {
      type: 'FORECAST_UPDATE',
      timestamp: new Date().toISOString(),
      top_locations: [
        {
          rank: 1,
          atm_id: 'ATM-ROH-04',
          city: 'Delhi NCR',
          latitude: 28.7041,
          longitude: 77.1025,
          forecast_score: 0.94,
          risk_score: 94,
          confidence: 0.93,
          mapping_confidence: 0.95,
          severity: 'CRITICAL',
          alert_eligible: true,
          primary_evidence: '3 active mule accounts within 2km; rapid withdrawal burst signature',
          factor_contributions: {
            mule_proximity: 0.92,
            velocity_anomaly: 0.89,
            structuring_pattern: 0.85,
          },
        },
        {
          rank: 2,
          atm_id: 'ATM-LXN-11',
          city: 'East Delhi',
          latitude: 28.6304,
          longitude: 77.2773,
          forecast_score: 0.86,
          risk_score: 86,
          confidence: 0.88,
          mapping_confidence: 0.91,
          severity: 'HIGH',
          alert_eligible: true,
          primary_evidence: 'Peer-to-peer UPI layering termination; linked to NCRP complaint #88190',
          factor_contributions: {
            upi_layering: 0.88,
            sim_swap: 0.82,
          },
        },
        {
          rank: 3,
          atm_id: 'ATM-GUR-22',
          city: 'Gurugram',
          latitude: 28.4817,
          longitude: 77.0807,
          forecast_score: 0.79,
          risk_score: 79,
          confidence: 0.82,
          mapping_confidence: 0.87,
          severity: 'HIGH',
          alert_eligible: true,
          primary_evidence: 'Cross-border interstate velocity hop from Delhi to Haryana',
          factor_contributions: {
            travel_speed_anomaly: 0.84,
          },
        },
      ],
      alert_updates: [
        {
          alert_id: 'ALT-2026-0041',
          atm_id: 'ATM-ROH-04',
          severity: 'CRITICAL',
          status: 'ACTIVE',
          risk_score: 94,
          message: 'Real-time alert: Rapid structuring burst at Rohini Sector 7 ATM-04',
          created_at: new Date().toISOString(),
        },
      ],
    };

    try {
      ws.send(JSON.stringify(initialPayload));
    } catch {
      // Ignore
    }

    // Ping / pong heartbeat response
    ws.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore unparseable messages
      }
    });
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.resolve(process.cwd(), 'PravahDridh/frontend'),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PravahDridh Platform Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
