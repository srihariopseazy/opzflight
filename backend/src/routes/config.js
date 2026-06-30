const express = require('express');
const router  = express.Router();

// Exposes Google Maps key to the frontend (Maps JS API key is inherently public).
// Restrict via HTTP referrer in Google Cloud Console.
router.get('/maps-key', (req, res) => {
  const key = process.env.GOOGLE_MAPS_KEY || '';
  if (!key || key === 'PLACEHOLDER') {
    return res.json({ key: null });
  }
  res.json({ key });
});

module.exports = router;
