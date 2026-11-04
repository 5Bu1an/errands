const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

router.get('/:requestId/messages', requireAuth, controller.getMessages);
router.post('/:requestId/messages', requireAuth, controller.sendMessage);

module.exports = router;