/**
 * API Key authentication middleware.
 *
 * Expected header:  X-API-Key: npcal_<32 hex chars>
 *
 * Validation steps:
 *  1. Parse and format-check the key
 *  2. SHA-256 hash -> look up in `apiKeys` Firestore collection
 *  3. Check active flag and daily rate limit (1000 req/day on free plan)
 *  4. Increment requestsToday + update lastUsed
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

const FREE_TIER_LIMIT = 1000;
const KEY_PREFIX = 'npcal_';
// key format: npcal_ + 32 hex chars = 38 chars total
const KEY_REGEX = /^npcal_[0-9a-f]{32}$/i;

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

async function apiKeyMiddleware(req, res, next) {
  const rawKey = req.headers['x-api-key'];

  if (!rawKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-Key header. Obtain a key to use this API.'
    });
  }

  if (!KEY_REGEX.test(rawKey)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format.'
    });
  }

  const hash = hashKey(rawKey);
  const db = admin.firestore();

  let keyDoc;
  try {
    const snap = await db.collection('apiKeys').where('keyHash', '==', hash).limit(1).get();
    if (snap.empty) {
      return res.status(401).json({ error: 'Unauthorized', message: 'API key not found.' });
    }
    keyDoc = snap.docs[0];
  } catch (err) {
    console.error('API key lookup failed:', err);
    return res.status(500).json({ error: 'Internal server error', message: 'Key validation failed.' });
  }

  const keyData = keyDoc.data();

  if (!keyData.active) {
    return res.status(401).json({ error: 'Unauthorized', message: 'API key has been revoked.' });
  }

  // Rate limit — reset counter if the stored date is not today
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const isNewDay = keyData.rateLimitDate !== todayStr;
  const currentCount = isNewDay ? 0 : (keyData.requestsToday || 0);
  const limit = keyData.rateLimit || FREE_TIER_LIMIT;

  if (currentCount >= limit) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Your plan allows ${limit} requests per day. Resets at midnight UTC.`,
      requestsToday: currentCount,
      limit
    });
  }

  // Increment — fire and forget (don't await, keeps latency low)
  keyDoc.ref.update({
    requestsToday: isNewDay ? 1 : admin.firestore.FieldValue.increment(1),
    rateLimitDate: todayStr,
    lastUsed: admin.firestore.FieldValue.serverTimestamp()
  }).catch(err => console.error('Failed to update key usage:', err));

  // Attach key metadata for optional logging in routes
  req.apiKey = {
    owner: keyData.owner,
    email: keyData.email,
    plan: keyData.plan || 'free',
    requestsToday: currentCount + 1,
    limit
  };

  next();
}

module.exports = { apiKeyMiddleware };
