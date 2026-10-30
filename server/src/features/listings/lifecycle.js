// US-08: Listing status rules. Each status lists the statuses it may move to.
// Only forward moves are allowed. COMPLETED and CANCELLED are final.
const TRANSITIONS = {
  OPEN: ['REQUESTED', 'CANCELLED'],
  REQUESTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

const STATUSES = Object.keys(TRANSITIONS);

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

module.exports = { TRANSITIONS, STATUSES, canTransition };
