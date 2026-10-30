// US-08: Request status rules. Each status lists the statuses it may move to.
// Only forward moves are allowed. DECLINED and CANCELLED are final.
const TRANSITIONS = {
  PENDING: ['ACCEPTED', 'DECLINED', 'CANCELLED'],
  ACCEPTED: ['CANCELLED'],
  DECLINED: [],
  CANCELLED: []
};

const STATUSES = Object.keys(TRANSITIONS);

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

module.exports = { TRANSITIONS, STATUSES, canTransition };
