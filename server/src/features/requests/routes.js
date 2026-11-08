const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// US-07: Owner sees the requests on their listing
router.get('/listing/:listingId', requireAuth, controller.listForListing);

// US-08: Change a request's status (lifecycle rules enforced)
router.patch('/:id/status', requireAuth, controller.updateStatus);

module.exports = router;
