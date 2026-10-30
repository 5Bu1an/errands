const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// Create a new listing
router.post('/', requireAuth, controller.create);

// US-09: View details of a specific listing
router.get('/:id', requireAuth, controller.getById);

// US-14: Cancel a listing
router.patch('/:id/cancel', requireAuth, controller.cancel);

// US-08: Change a listing's status (lifecycle rules enforced)
router.patch('/:id/status', requireAuth, controller.updateStatus);

module.exports = router;