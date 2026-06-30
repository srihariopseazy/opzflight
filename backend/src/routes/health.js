const express = require('express');
const { query } = require('../db/pool');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await query('SELECT NOW() AS db_time');
    res.json({
      status: 'ok',
      db: 'connected',
      db_time: result.rows[0].db_time,
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

module.exports = router;
