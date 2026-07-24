import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from '@lms/shared';
import authRoutes from './routes/auth.routes';

const app = express();
const PORT = process.env.AUTH_PORT || 8001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth-service', timestamp: new Date() });
});

// authMiddleware (and any other route handler) forwards errors via next(err);
// without these, Express's default handler would leak stack traces to clients.
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Auth Service] Running on port ${PORT}`);
});
