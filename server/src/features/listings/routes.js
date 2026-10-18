const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

router.post('/', requireAuth, controller.create);

module.exports = router;
