import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const REDIS_KEY = 'shadow-tagger:visitors';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const isOwner = req.headers['x-owner'] === process.env.OWNER_SECRET;

    if (req.method === 'POST') {
      if (!isOwner && ip !== 'unknown') {
        await redis.sadd(REDIS_KEY, ip);
      }
    }

    const count = await redis.scard(REDIS_KEY);
    return res.status(200).json({ count });
  } catch (err) {
    console.error('Visit API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
