
const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// US-11: View trip progress (owner or accepted rider).
router.get('/:id/tracking', requireAuth, controller.getTracking);

// US-11: Post a trip progress update (ride owner only).
router.post('/:id/tracking', requireAuth, controller.createTrackingUpdate);

module.exports = router;
