const router = require('express').Router();
const controller = require('./controller');

router.post('/signup', controller.signUp);

module.exports = router;