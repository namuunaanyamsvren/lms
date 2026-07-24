import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from '@lms/shared';
import routes from './routes';

const app = express();
const PORT = process.env.ACADEMIC_PORT || process.env.PORT || 8003;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'academic-service', timestamp: new Date() });
});

// authMiddleware (and any other route handler) forwards errors via next(err);
// without these, Express's default handler would leak stack traces to clients.
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Academic Service] Running on port ${PORT}`);
});
