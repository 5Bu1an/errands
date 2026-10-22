
const service = require('./service');

// US-09: Get details of a single listing
async function getById(req, res, next) {
  try {
    const id = req.params.id;

    // Check that the listing ID is a valid UUID
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return res.status(400).json({
        error: 'Invalid listing ID'
      });
    }

    const listing = await service.getById(id);

    if (!listing) {
      return res.status(404).json({
        error: 'Listing not found'
      });
    }

    return res.status(200).json({ listing });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getById };
