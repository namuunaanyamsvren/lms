import express from 'express';
import cors from 'cors';
import { config } from './config';
import apiRoutes from './routes';

const app = express();

app.use(cors());
// NOTE: no express.json() here. The gateway has no routes of its own that
// read req.body (only /health), and every other route is proxied through to
// a downstream service. Parsing the body here would consume the request
// stream before http-proxy-middleware can pipe it through, causing proxied
// POST/PUT/PATCH requests to hang waiting for a body that never arrives.

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway', timestamp: new Date() });
});

// Proxy routes
app.use(apiRoutes);

app.listen(config.port, () => {
  console.log(`[API Gateway] Running on port ${config.port}`);
});
