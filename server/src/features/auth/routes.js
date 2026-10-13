const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');

router.post('/signup', controller.signUp);
router.post('/login', controller.logIn);
router.post('/logout', requireAuth, controller.logOut);
router.get('/me', requireAuth, controller.me);

module.exports = router;