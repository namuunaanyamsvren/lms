import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8005;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`[Notification Service] Running on port ${PORT}`);
});
