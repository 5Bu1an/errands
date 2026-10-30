const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// US-08: Change a request's status (lifecycle rules enforced)
router.patch('/:id/status', requireAuth, controller.updateStatus);

module.exports = router;
