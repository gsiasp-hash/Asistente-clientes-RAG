import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'rag-support-api',
    timestamp: new Date().toISOString(),
  });
});

const PORT = Number(process.env.PORT ?? 5000);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
