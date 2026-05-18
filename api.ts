import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Health check (proves the server is alive)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Fractal Trading v2 is alive',
    timestamp: new Date().toISOString()
  });
});

// Placeholder for Lake state
app.get('/api/state', (req, res) => {
  res.json({
    openPositions: {},
    directives: {},
    lastCommit: null
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Fractal Trading v2 running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});