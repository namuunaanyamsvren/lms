import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8004;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'billing-service', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`[Billing Service] Running on port ${PORT}`);
});
