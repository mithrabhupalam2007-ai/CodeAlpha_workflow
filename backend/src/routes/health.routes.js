const router = require("express").Router();

const { getHealth } = require("../controllers/health.controller");

// GET /api/health
router.get("/", getHealth);

module.exports = router;
