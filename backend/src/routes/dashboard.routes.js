const router = require("express").Router();

const requireAuth = require("../middleware/requireAuth");
const { getSummary, getActivity } = require("../controllers/dashboard.controller");

// All dashboard routes require a valid session
router.use(requireAuth);

// GET /api/dashboard/summary — stats + panels in one call
router.get("/summary", getSummary);

// GET /api/dashboard/activity?limit=8 — topbar notification feed
router.get("/activity", getActivity);

// PATCH /api/dashboard/activity/:id/read — mark notification as read
router.patch("/activity/:id/read", requireAuth, async (req, res, next) => {
  try {
    const Activity = require("../models/Activity");
    await Activity.updateOne(
      { _id: req.params.id, user: req.user.id },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
