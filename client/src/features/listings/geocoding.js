
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const cache = new Map();
const pending = new Map();

let nextRequestTime = 0;
let requestQueue = Promise.resolve();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Keep requests at least 1.1 seconds apart.
function scheduleLookup(task) {
  const run = requestQueue.then(async () => {
    const delay = Math.max(0, nextRequestTime - Date.now());

    if (delay > 0) {
      await wait(delay);
    }

    nextRequestTime = Date.now() + 1100;
    return task();
  });

  requestQueue = run.catch(() => {});
  return run;
}

// Convert a place name or address into [latitude, longitude].
export async function geocodeLocation(location) {
  const query = location?.trim();

  if (!query) return null;

  const key = query.toLowerCase();

  if (cache.has(key)) {
    return cache.get(key);
  }

  if (pending.has(key)) {
    return pending.get(key);
  }

  const lookup = scheduleLookup(async () => {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'ca'
    });

    const response = await fetch(`${NOMINATIM_URL}?${params}`);

    if (!response.ok) {
      throw new Error('Location lookup is temporarily unavailable.');
    }

    const results = await response.json();

    if (!results.length) {
      cache.set(key, null);
      return null;
    }

    const latitude = Number(results[0].lat);
    const longitude = Number(results[0].lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const coordinates = [latitude, longitude];
    cache.set(key, coordinates);

    return coordinates;
  });

  pending.set(key, lookup);

  try {
    return await lookup;
  } finally {
    pending.delete(key);
  }
}
