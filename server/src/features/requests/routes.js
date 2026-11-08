const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// US-06: Request a seat with a typed pickup point.
router.post('/', requireAuth, controller.create);

// US-08: Change a request's status.
router.patch('/:id/status', requireAuth, controller.updateStatus);

module.exports = router;