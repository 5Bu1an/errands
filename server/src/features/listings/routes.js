const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// Create a new listing
router.post('/', requireAuth, controller.create);

// US-09: View details of a specific listing
router.get('/:id', requireAuth, controller.getById);

module.exports = router;