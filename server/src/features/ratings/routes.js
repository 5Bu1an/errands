const router = require('express').Router();
const requireAuth = require('../../middleware/requireAuth');
const service = require('./service');

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errors = {
  INVALID_SCORE: [400, 'Score must be a whole number from 1 to 5'],
  INVALID_COMMENT: [400, 'Comment must be text of at most 1000 characters'],
  SELF_RATING: [400, 'You cannot rate yourself'],
  NOT_FOUND: [404, 'Listing not found'],
  FORBIDDEN: [403, 'You can only rate the other participant'],
  NOT_COMPLETED: [409, 'The listing must be completed before rating'],
  ALREADY_RATED: [409, 'You already rated this person for this listing']
};

router.use(requireAuth);

// POST /ratings
router.post('/', async (req, res, next) => {
  try {
    const { listingId, receiverId, score, comment } = req.body || {};

    if (
      typeof listingId !== 'string' ||
      typeof receiverId !== 'string' ||
      !UUID.test(listingId) ||
      !UUID.test(receiverId)
    ) {
      return res.status(400).json({
        error: 'Valid listingId and receiverId are required'
      });
    }

    // The logged-in user is always the giver.
    const result = await service.createRating(req.user.id, {
      listingId,
      receiverId,
      score,
      comment
    });

    if (result.error) {
      const [status, message] = errors[result.error];
      return res.status(status).json({ error: message });
    }

    return res.status(201).json({ rating: result.rating });
  } catch (error) {
    next(error);
  }
});

// GET /ratings/users/:userId/summary
router.get('/users/:userId/summary', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const summary = await service.getRatingSummary(req.params.userId);
    return res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/listings/:listingId/options', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.listingId)) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const result = await service.getRatingOptions(
      req.params.listingId,
      req.user.id
    );

    if (result.error) {
      const [status, message] = errors[result.error];
      return res.status(status).json({ error: message });
    }

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;