import { Router } from 'express';
import { clearAllStore } from '../store.js';
import { isRedisEnabled } from '../redis-client.js';

const router = Router();

/** Clear all olo-ui:* keys in Redis and reset store. Only works when Redis is enabled. */
router.post('/clear', async (req, res) => {
  if (!isRedisEnabled()) {
    return res.status(400).json({ cleared: false, error: 'Redis not in use. Clear all only applies to Redis store.' });
  }
  try {
    const result = await clearAllStore();
    if (!result.cleared) {
      return res.status(500).json({ cleared: false, error: 'Clear failed or Redis unavailable.' });
    }
    res.json({ cleared: true, keysDeleted: result.keysDeleted ?? 0 });
  } catch (err) {
    console.error('Store clear error:', err);
    res.status(500).json({ cleared: false, error: err.message || 'Clear failed.' });
  }
});

export default router;
