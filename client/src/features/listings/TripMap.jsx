import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeLocation } from './geocoding';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

function FitMapBounds({ pickup, destination }) {
  const map = useMap();

  useEffect(() => {
    if (!pickup || !destination) return;

    map.fitBounds([pickup, destination], {
      padding: [40, 40],
      maxZoom: 15
    });
  }, [map, pickup, destination]);

  return null;
}

export default function TripMap({ pickupLabel, destinationLabel }) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCoordinates() {
      setLoading(true);
      setError('');
      setPickup(null);
      setDestination(null);

      if (!pickupLabel?.trim() || !destinationLabel?.trim()) {
        setLoading(false);
        return;
      }

      try {
        const [pickupCoords, destinationCoords] = await Promise.all([
          geocodeLocation(pickupLabel),
          geocodeLocation(destinationLabel)
        ]);

        if (!active) return;

        setPickup(pickupCoords);
        setDestination(destinationCoords);
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load map locations.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCoordinates();

    return () => {
      active = false;
    };
  }, [pickupLabel, destinationLabel]);

  if (loading) {
    return <p className="empty">Loading trip map...</p>;
  }

  if (error) {
    return <p role="alert" className="error">{error}</p>;
  }

  if (!pickup || !destination) {
    return (
      <p className="empty">
        Map unavailable: both pickup and destination must be identifiable locations.
      </p>
    );
  }

  return (
    <div style={{ height: 350, width: '100%', marginTop: 16 }}>
      <MapContainer
        center={pickup}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', borderRadius: 12 }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={pickup}>
          <Popup>
            <strong>Pickup</strong>
            <div>{pickupLabel}</div>
          </Popup>
        </Marker>

        <Marker position={destination}>
          <Popup>
            <strong>Destination</strong>
            <div>{destinationLabel}</div>
          </Popup>
        </Marker>

        <FitMapBounds pickup={pickup} destination={destination} />
      </MapContainer>
    </div>
  );
}
