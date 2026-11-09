
const service = require('./service');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// US-11: Get trip progress for the owner or an accepted rider.
async function getTracking(req, res, next) {
  try {
    const { id } = req.params;

    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({
        error: 'Invalid listing ID',
      });
    }

    const result = await service.getTracking(id, req.user.id);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'Ride listing not found',
      });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'You are not authorized to view this trip',
      });
    }

    return res.status(200).json({
      updates: result.updates,
      latestStep: result.latestStep,
    });
  } catch (err) {
    return next(err);
  }
}

// US-11: Allow the ride owner to post the next tracking step.
async function createTrackingUpdate(req, res, next) {
  try {
    const { id } = req.params;
    const { step } = req.body || {};

    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({
        error: 'Invalid listing ID',
      });
    }

    if (!service.STEPS.includes(step)) {
      return res.status(400).json({
        error: 'Invalid tracking step',
        allowedSteps: service.STEPS,
      });
    }

    const result = await service.createTrackingUpdate(
      id,
      req.user.id,
      step
    );

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'Ride listing not found',
      });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'Only the ride owner can update trip progress',
      });
    }

    if (result.error === 'INVALID_STATUS') {
      return res.status(409).json({
        error: 'Trip tracking is not available in the current listing status',
      });
    }

    if (result.error === 'INVALID_SEQUENCE') {
      return res.status(409).json({
        error: 'Tracking steps must be posted in order',
        expectedStep: result.expectedStep,
      });
    }

    return res.status(201).json({
      message: 'Trip progress updated',
      update: result.update,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getTracking,
  createTrackingUpdate,
};
