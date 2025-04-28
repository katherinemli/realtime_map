/**
 * geoUtils.js
 * Geographic utilities for coordinate operations
 */

const geoUtils = {
  /**
   * Normalizes longitude coordinates to handle the international date line
   * @param {Number} lon - Longitude
   * @returns {Number} Normalized longitude between -180 and 180
   */
  normalizeCoordinates(lon) {
    if (lon > 180) {
      return lon - 360;
    } else if (lon < -180) {
      return lon + 360;
    }
    return lon;
  },

  /**
   * Calculates distance between two points in kilometers
   * @param {Number} lat1 - Latitude of first point
   * @param {Number} lon1 - Longitude of first point
   * @param {Number} lat2 - Latitude of second point
   * @param {Number} lon2 - Longitude of second point
   * @returns {Number} Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  },

  /**
   * Converts degrees to radians
   * @param {Number} deg - Degrees
   * @returns {Number} Radians
   */
  deg2rad(deg) {
    return deg * (Math.PI / 180);
  },

  /**
   * Converts radians to degrees
   * @param {Number} rad - Radians
   * @returns {Number} Degrees
   */
  rad2deg(rad) {
    return rad * (180 / Math.PI);
  },

  /**
   * Checks if a point is within a rectangle defined by two corners
   * @param {Number} lat - Point latitude
   * @param {Number} lon - Point longitude
   * @param {Object} bounds - Bounds {north, south, east, west}
   * @returns {Boolean} True if point is inside the rectangle
   */
  isPointInBounds(lat, lon, bounds) {
    return (
      lat <= bounds.north &&
      lat >= bounds.south &&
      lon <= bounds.east &&
      lon >= bounds.west
    );
  },

  /**
   * Converts Leaflet bounds to standard format
   * @param {Object} leafletBounds - Leaflet LatLngBounds object
   * @returns {Object} Bounds in {north, south, east, west} format
   */
  convertLeafletBounds(leafletBounds) {
    return {
      north: leafletBounds.getNorth(),
      south: leafletBounds.getSouth(),
      east: leafletBounds.getEast(),
      west: leafletBounds.getWest()
    };
  },

  /**
   * Calculates the center of a set of points
   * @param {Array} points - Array of {lat, lon} objects
   * @returns {Object} Center {lat, lon}
   */
  calculateCenter(points) {
    if (!points || points.length === 0) {
      return { lat: 0, lon: 0 };
    }

    let sumLat = 0;
    let sumLon = 0;

    points.forEach(point => {
      sumLat += point.lat;
      sumLon += this.normalizeCoordinates(point.lon);
    });

    return {
      lat: sumLat / points.length,
      lon: sumLon / points.length
    };
  },

  /**
   * Finds appropriate zoom level to show all points
   * @param {Array} points - Array of {lat, lon} objects
   * @param {Object} mapSize - Map size {width, height}
   * @returns {Number} Recommended zoom level
   */
  calculateZoomLevel(points, mapSize) {
    if (!points || points.length <= 1) {
      return 5; // Default zoom
    }

    // Find bounds
    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;

    points.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);

      const lon = this.normalizeCoordinates(point.lon);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    });

    // Calculate distances
    const latDistance = maxLat - minLat;
    const lonDistance = maxLon - minLon;

    // Calculate zoom based on largest distance
    let zoom;
    if (latDistance > lonDistance) {
      zoom = Math.log2(360 / latDistance);
    } else {
      zoom = Math.log2(360 / lonDistance);
    }

    // Adjust by map size
    const size = Math.min(mapSize.width, mapSize.height);
    zoom += Math.log2(size / 256);

    // Limit to reasonable values
    return Math.min(Math.max(Math.floor(zoom), 2), 18);
  }
};

export default geoUtils;