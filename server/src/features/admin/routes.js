const router = require('express').Router();
const controller = require('./controller');
const requireAuth = require('../../middleware/requireAuth');
const requireAdmin = require('../../middleware/requireAdmin');

// US-19: Admin only. View users and listings, review reports, remove content.
router.use(requireAuth, requireAdmin);

router.get('/users', controller.listUsers);
router.delete('/users/:id', controller.removeUser);

router.get('/listings', controller.listListings);
router.delete('/listings/:id', controller.removeListing);

router.get('/reports', controller.listReports);
router.patch('/reports/:id', controller.updateReport);

module.exports = router;
