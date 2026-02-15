import { Router } from 'express';
import { getPipelines, getPipelinesRag } from '../pipelines.js';

const router = Router();

router.get('/', (req, res) => {
  const pipelines = getPipelines();
  const pipelinesRag = getPipelinesRag();
  res.json({ pipelines, pipelinesRag });
});

export default router;
