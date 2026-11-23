const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// US-20: Report a user or listing
router.post('/', requireAuth, controller.create);

module.exports = router;
