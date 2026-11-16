
const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// US-06: Request a seat with a typed pickup point.
router.post('/', requireAuth, controller.create);

// US-18: Requests I have made.
router.get('/mine', requireAuth, controller.listMine);

// US-07: Owner sees the requests on their listing.
router.get('/listing/:listingId', requireAuth, controller.listForListing);

// US-08: Change a request's status.
router.patch('/:id/status', requireAuth, controller.updateStatus);

module.exports = router;
