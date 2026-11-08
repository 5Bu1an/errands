const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// US-12: View and edit my profile
router.get('/me', requireAuth, controller.getMe);
router.patch('/me', requireAuth, controller.updateMe);

module.exports = router;
