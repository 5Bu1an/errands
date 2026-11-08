const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

// US-16: See my in-app notifications
router.get('/', requireAuth, controller.list);

module.exports = router;
