import cors from 'cors';
import express from 'express';
import { chatRoutes } from './routes/chatRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'kronos-server' });
});

app.use('/api', chatRoutes);

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`kronos server running on http://localhost:${PORT}`);
});
