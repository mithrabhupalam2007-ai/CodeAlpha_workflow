const router = require("express").Router();

const requireAuth = require("../middleware/requireAuth");
const { getSummary, getActivity } = require("../controllers/dashboard.controller");

// All dashboard routes require a valid session
router.use(requireAuth);

// GET /api/dashboard/summary — stats + panels in one call
router.get("/summary", getSummary);

// GET /api/dashboard/activity?limit=8 — topbar notification feed
router.get("/activity", getActivity);

module.exports = router;
