const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);

module.exports = router;
