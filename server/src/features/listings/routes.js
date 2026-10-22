const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

router.post('/', requireAuth, controller.create);

// US-14: Cancel a listing
router.patch('/:id/cancel', requireAuth, controller.cancel);

module.exports = router;