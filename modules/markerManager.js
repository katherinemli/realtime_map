/**
 * markerManager.js
 * Manages marker creation, updating, and deletion on the map
 */

import L from 'leaflet';
import markerRenderer from './markerRenderer.js';
import geoUtils from '../utilsMap/geoUtils.js';

const markerManager = {
  // References to other modules
  mapCoordinator: null,
  map: null,
  markerLayer: null,

  // Marker storage
  markers: [],         // Marker data
  markerInstances: new Map(), // ID to Leaflet instance mapping
  markerGroups: {},    // Marker groupings by categories

  // Marker mode
  currentClusterMode: false,
  clusterGroup: null,

  /**
   * Initializes the marker manager
   * @param {Object} coordinator - Coordinator instance
   * @param {Object} mapInstance - Leaflet map instance
   * @param {Object} layer - Marker layer
   */
  initialize(coordinator, mapInstance, layer) {
    this.mapCoordinator = coordinator;
    this.map = mapInstance;
    this.markerLayer = layer;

    if (coordinator.debug) {
      //console.log('[MarkerManager] Initialized');
    }
  },

  /**
   * Processes a set of markers to display on the map
   * @param {Object} coordinator - Coordinator state
   * @param {Array} markerList - List of marker data
   * @returns {Promise} Promise that resolves when processing is complete
   */
  async processMarkers(coordinator, markerList) {
    if (coordinator.debug) {
      //console.log('[MarkerManager] Processing markers...', markerList.length);
    }

    if (!markerList || !Array.isArray(markerList)) {
      console.warn('[MarkerManager] Invalid marker list');
      return Promise.resolve();
    }

    // Separate markers with and without coordinates
    const markersWithCoords = [];
    const markersWithoutCoords = [];

    // Process each marker
    markerList.forEach(marker => {
      // Add additional properties
      marker.id = marker.id || `marker_${marker.i}`;
      marker.iconNumber = marker.i % 16;
      marker.iconColor = Math.floor(marker.i / 16);

      // Separate by coordinates
      if (marker.lat === null || marker.lon === null) {
        markersWithoutCoords.push(marker);
      } else {
        markersWithCoords.push(marker);

        // Duplicate markers crossing the date line
        if (marker.lon < -140 || marker.lon > 140) {
          this.duplicateMarkerAcrossDateLine(marker, markersWithCoords);
        }
      }
    });

    // Save processed markers
    this.markers = markersWithCoords;

    // Create markers on the map
    await this.createMarkers(coordinator);

    return Promise.resolve();
  },

  /**
   * Updates marker icon sizes for all markers
   * @param {Object} coordinator - Coordinator state
   * @param {Object} iconSizes - Size configuration
   * @returns {Promise} Promise that resolves when update is complete
   */
  async updateAllIconSizes(coordinator, iconSizes) {
    if (coordinator.debug) {
      //console.log(`[MarkerManager] Updating icon sizes for ${this.markerInstances.size} markers with size: ${iconSizes.icon.size[0]}x${iconSizes.icon.size[1]}`);
    }

    // Ensure using numeric values
    const width = parseInt(iconSizes.icon.size[0], 10);
    const height = parseInt(iconSizes.icon.size[1], 10);

    // Create backup copy to avoid reference issues
    const iconSizesCopy = {
      icon: {
        size: [width, height],
        anchor: [Math.floor(width / 2), Math.floor(height / 2)],
        popupAnchor: [0, -Math.floor(height / 2)]
      },
      satellite: {
        size: [
          parseInt(iconSizes.satellite.size[0], 10),
          parseInt(iconSizes.satellite.size[1], 10)
        ],
        anchor: [
          Math.floor(parseInt(iconSizes.satellite.size[0], 10) / 2),
          Math.floor(parseInt(iconSizes.satellite.size[1], 10) / 2)
        ],
        popupAnchor: [
          0,
          -Math.floor(parseInt(iconSizes.satellite.size[1], 10) / 2)
        ]
      }
    };

    // Clear renderer cache to force regeneration
    if (markerRenderer && typeof markerRenderer.clearIconCache === 'function') {
      markerRenderer.clearIconCache();
    }

    let updatedCount = 0;

    // For each marker, update its icon
    for (const [markerId, marker] of this.markerInstances.entries()) {
      try {
        // Get marker data
        const markerData = this.markers.find(m => m.id === markerId);

        if (markerData) {
          // Create a new icon with updated size
          const newIcon = markerRenderer.createMarkerIcon(coordinator, markerData, iconSizesCopy);

          // Apply the new icon
          marker.setIcon(newIcon);
          updatedCount++;

          if (coordinator.debug) {
            //console.log(`[MarkerManager] Icon updated for marker ${markerId} with size ${width}x${height}`);
          }
        }
      } catch (error) {
        console.error(`[MarkerManager] Error updating icon for marker ${markerId}:`, error);
      }
    }

    return Promise.resolve();
  },

  /**
   * Updates tooltip state for all markers
   * @param {Object} coordinator - Coordinator state
   * @param {Boolean} enabled - If tooltips should be visible
   * @returns {Promise} Promise that resolves when update is complete
   */
  async updateTooltipState(coordinator, enabled) {
    if (coordinator.debug) {
      //console.log(`[MarkerManager] Updating tooltip state to: ${enabled ? 'visible' : 'hidden'}`);
    }

    for (const marker of this.markerInstances.values()) {
      try {
        if (enabled) {
          if (marker.getTooltip) {
            // Ensure tooltip is set as permanent
            const tooltip = marker.getTooltip();
            if (tooltip && !tooltip.options.permanent) {
              marker.unbindTooltip();
              marker.bindTooltip(tooltip.getContent(), {
                permanent: true,
                direction: 'bottom',
                className: 'custom-tooltip'
              });
            }
            marker.openTooltip();
          }
        } else {
          if (marker.closeTooltip) {
            marker.closeTooltip();
          }
        }
      } catch (error) {
        console.error('[MarkerManager] Error updating tooltip state:', error);
      }
    }

    return Promise.resolve();
  },

  /**
   * Updates markers with new data
   * @param {Object} coordinator - Coordinator state
   * @param {Object} data - New data
   * @returns {Promise} Promise that resolves when update is complete
   */
  async updateMarkersFromData(coordinator, data) {
    if (coordinator.debug) {
      //console.log('[MarkerManager] Updating markers with new data');
    }

    if (!data || !data.list) {
      console.warn('[MarkerManager] Invalid data for update');
      return Promise.resolve();
    }

    // If there are significant changes, process all again
    if (this.shouldRefreshAllMarkers(data)) {
      return this.processMarkers(coordinator, data.list);
    }

    // Otherwise, update only markers that have changed
    await this.updateChangedMarkers(coordinator, data.list);

    return Promise.resolve();
  },

  /**
   * Determines if all markers should be reloaded
   * @param {Object} data - New data
   * @returns {Boolean} True if a full update should be performed
   */
  shouldRefreshAllMarkers(data) {
    // If there's a significant difference in quantity
    if (Math.abs(this.markers.length - data.list.length) > 10) {
      return true;
    }

    // If global configuration changed
    if (data.map_url || data.refreshMode) {
      return true;
    }

    return false;
  },

  /**
   * Updates only markers that have changed
   * @param {Object} coordinator - Coordinator state
   * @param {Array} newMarkerList - New list of markers
   * @returns {Promise} Promise that resolves when update is complete
   */
  async updateChangedMarkers(coordinator, newMarkerList) {
    // Create a map of current markers by ID
    const currentMarkersMap = new Map();
    this.markers.forEach(m => currentMarkersMap.set(m.id, m));

    // New markers to add
    const markersToAdd = [];

    // IDs of markers to remove
    const markersToRemove = new Set([...currentMarkersMap.keys()]);

    // Iterate through new markers
    for (const newMarker of newMarkerList) {
      newMarker.id = newMarker.id || `marker_${newMarker.i}`;

      // Ignore markers without coordinates
      if (newMarker.lat === null || newMarker.lon === null) {
        continue;
      }

      // Remove from list of markers to remove
      markersToRemove.delete(newMarker.id);

      // If already exists, check if it has changed
      if (currentMarkersMap.has(newMarker.id)) {
        const currentMarker = currentMarkersMap.get(newMarker.id);

        // Check if marker has changed
        if (this.hasMarkerChanged(currentMarker, newMarker)) {
          await this.updateMarker(coordinator, newMarker);
        }
      } else {
        // It's a new marker
        markersToAdd.push(newMarker);

        // If crosses date line, duplicate
        if (newMarker.lon < -140 || newMarker.lon > 140) {
          this.duplicateMarkerAcrossDateLine(newMarker, markersToAdd);
        }
      }
    }

    // Remove markers that no longer exist
    for (const idToRemove of markersToRemove) {
      await this.removeMarker(coordinator, idToRemove);
    }

    // Add new markers
    if (markersToAdd.length > 0) {
      // Add to marker list
      this.markers = this.markers.filter(m => !markersToRemove.has(m.id)).concat(markersToAdd);

      // Create markers on the map
      await this.createSpecificMarkers(coordinator, markersToAdd);
    }

    return Promise.resolve();
  },

  /**
   * Checks if a marker has changed significantly
   * @param {Object} oldMarker - Current marker data
   * @param {Object} newMarker - New marker data
   * @returns {Boolean} True if marker has changed
   */
  hasMarkerChanged(oldMarker, newMarker) {
    // Check changes in critical properties
    if (oldMarker.lat !== newMarker.lat || oldMarker.lon !== newMarker.lon) {
      return true; // Location changed
    }

    if (oldMarker.name !== newMarker.name) {
      return true; // Name changed
    }

    if (oldMarker.var !== newMarker.var) {
      return true; // State/variant changed
    }

    if (oldMarker.i !== newMarker.i) {
      return true; // Index/icon changed
    }

    // No significant change
    return false;
  },

  /**
   * Duplicates a marker across the date line
   * @param {Object} marker - Marker data
   * @param {Array} markersArray - Array to add the marker to
   */
  duplicateMarkerAcrossDateLine(marker, markersArray) {
    const duplicatedMarker = { ...marker };

    // Assign unique ID for the duplicate
    duplicatedMarker.id = `${marker.id}_dateline`;

    // Adjust longitude to the other side of the map
    if (marker.lon < 0) {
      duplicatedMarker.lon = 180 + (180 + marker.lon);
    } else {
      duplicatedMarker.lon = -180 - (180 - marker.lon);
    }

    markersArray.push(duplicatedMarker);
  },

  /**
   * Creates all markers on the map
   * @param {Object} coordinator - Coordinator state
   * @returns {Promise} Promise that resolves when creation is complete
   */
  async createMarkers(coordinator) {
    if (coordinator.debug) {
      //console.log(`[MarkerManager] Creating ${this.markers.length} markers on the map...`);
    }

    // Clear existing markers
    await this.clearAllMarkers();

    // Create new markers
    await this.createSpecificMarkers(coordinator, this.markers);

    return Promise.resolve();
  },

  /**
   * Creates specific markers on the map
   * @param {Object} coordinator - Coordinator state
   * @param {Array} markerList - List of markers to create
   * @returns {Promise} Promise that resolves when creation is complete
   */
  async createSpecificMarkers(coordinator, markerList) {
    // Check if we should use clustering
    const useCluster = coordinator.currentMarkerMode && coordinator.currentMarkerMode.includes('cluster');

    // If cluster mode changes, reset
    if (useCluster !== this.currentClusterMode) {
      await this.toggleClusterMode(coordinator, useCluster);
    }

    // Create each marker
    for (let i = 0; i < markerList.length; i++) {
      const markerData = markerList[i];

      // Normalize longitude
      const lon = geoUtils.normalizeCoordinates(markerData.lon);

      // Create marker using renderer
      const icon = markerRenderer.createMarkerIcon(coordinator, markerData);
      const marker = L.marker([markerData.lat, lon], {
        icon,
        markerId: markerData.id,
        markerVar: markerData.var,
        tooltipContent: markerData.name
      });

      // Create popup
      const popupContent = markerRenderer.createMarkerPopup(markerData, lon);
      marker.bindPopup(popupContent);

      // Configure popup events
      markerRenderer.setupPopupEvents(marker);

      // Create tooltip
      const tooltipContent = markerRenderer.createMarkerTooltip(markerData);
      marker.bindTooltip(tooltipContent, {
        permanent: coordinator.currentTooltipState,
        direction: 'bottom',
        className: 'custom-tooltip'
      });

      // Save marker reference
      this.markerInstances.set(markerData.id, marker);

      // Add marker to appropriate layer
      if (useCluster) {
        this.clusterGroup.addLayer(marker);
      } else {
        this.markerLayer.addLayer(marker);
      }

      // Update progress
      if (i % 50 === 0 && coordinator.currentEvent) {
        coordinator.currentEvent.progress = Math.floor((i / markerList.length) * 100);
      }
    }

    if (coordinator.debug) {
      //console.log(`[MarkerManager] ${markerList.length} markers created`);
    }

    return Promise.resolve();
  },

  /**
     * Updates an existing marker
     * @param {Object} coordinator - Coordinator state
     * @param {Object} markerData - New marker data
     * @returns {Promise} Promise that resolves when update is complete
     */
  async updateMarker(coordinator, markerData) {
    const markerId = markerData.id;

    // Check if marker exists
    if (!this.markerInstances.has(markerId)) {
      console.warn(`[MarkerManager] Attempting to update non-existent marker: ${markerId}`);
      return Promise.resolve();
    }

    // Get marker instance
    const marker = this.markerInstances.get(markerId);

    // Update position if changed
    const lon = geoUtils.normalizeCoordinates(markerData.lon);
    marker.setLatLng([markerData.lat, lon]);

    // Update icon if changed
    const newIcon = markerRenderer.createMarkerIcon(coordinator, markerData);
    marker.setIcon(newIcon);

    // Update popup if changed
    const newPopupContent = markerRenderer.createMarkerPopup(markerData, lon);

    // If popup is open, keep it open after updating
    const isOpen = marker.isPopupOpen();
    marker.unbindPopup();
    marker.bindPopup(newPopupContent);
    if (isOpen) {
      marker.openPopup();
    }

    // Update reference in data
    const index = this.markers.findIndex(m => m.id === markerId);
    if (index !== -1) {
      this.markers[index] = markerData;
    }

    return Promise.resolve();
  },

  /**
   * Removes a specific marker
   * @param {Object} coordinator - Coordinator state
   * @param {String} markerId - ID of marker to remove
   * @returns {Promise} Promise that resolves when removal is complete
   */
  async removeMarker(coordinator, markerId) {
    // Check if marker exists
    if (!this.markerInstances.has(markerId)) {
      return Promise.resolve();
    }

    // Get marker instance
    const marker = this.markerInstances.get(markerId);

    // Remove from appropriate layer
    if (this.currentClusterMode) {
      this.clusterGroup.removeLayer(marker);
    } else {
      this.markerLayer.removeLayer(marker);
    }

    // Remove reference
    this.markerInstances.delete(markerId);

    // Remove from data
    this.markers = this.markers.filter(m => m.id !== markerId);

    return Promise.resolve();
  },

  /**
   * Clears all markers
   * @returns {Promise} Promise that resolves when clearing is complete
   */
  async clearAllMarkers() {
    // Clear layers
    if (this.markerLayer) {
      this.markerLayer.clearLayers();
    }

    if (this.clusterGroup) {
      this.clusterGroup.clearLayers();
    }

    // Clear references
    this.markerInstances.clear();

    return Promise.resolve();
  },

  /**
   * Activates or deactivates cluster mode
   * @param {Object} coordinator - Coordinator state
   * @param {Boolean} enable - Enable or disable clustering
   * @returns {Promise} Promise that resolves when mode change is complete
   */
  async toggleClusterMode(coordinator, enable) {
    if (coordinator.debug) {
      //console.log(`[MarkerManager] ${enable ? 'Activating' : 'Deactivating'} cluster mode`);
    }

    // If no change, do nothing
    if (enable === this.currentClusterMode) {
      return Promise.resolve();
    }

    // Save all current markers
    const currentMarkers = [...this.markerInstances.values()];

    // Clear current layers
    await this.clearAllMarkers();

    if (enable) {
      // Create cluster group if it doesn't exist
      if (!this.clusterGroup) {
        this.clusterGroup = L.markerClusterGroup({
          maxClusterRadius: 40,
          disableClusteringAtZoom: 10
        });

        // Add group to map
        this.map.addLayer(this.clusterGroup);
      }

      // Add markers to cluster
      for (const marker of currentMarkers) {
        this.clusterGroup.addLayer(marker);
        this.markerInstances.set(marker.options.markerId, marker);
      }
    } else {
      // Remove cluster group from map if it exists
      if (this.clusterGroup) {
        this.map.removeLayer(this.clusterGroup);
      }

      // Add markers to normal layer
      for (const marker of currentMarkers) {
        this.markerLayer.addLayer(marker);
        this.markerInstances.set(marker.options.markerId, marker);
      }
    }

    // Update state
    this.currentClusterMode = enable;

    return Promise.resolve();
  },

  /**
   * Updates marker display mode
   * @param {Object} coordinator - Coordinator state
   * @param {String} mode - New mode ('num_state', 'icon_state', 'cluster', etc.)
   * @returns {Promise} Promise that resolves when mode change is complete
   */
  async updateMarkerMode(coordinator, mode) {
    if (coordinator.debug) {
      //console.log(`[MarkerManager] Updating display mode to: ${mode}`);
    }

    // Update mode in coordinator
    coordinator.currentMarkerMode = mode;

    // Clear icon cache to force regeneration
    if (markerRenderer && typeof markerRenderer.clearIconCache === 'function') {
      markerRenderer.clearIconCache();
    }

    // Enable/disable clustering based on mode
    const useCluster = mode.includes('cluster');
    await this.toggleClusterMode(coordinator, useCluster);

    // Specific configuration by mode
    if (mode === 'num_state') {
      // State mode - Use discrete colors for states
      if (coordinator.debug) {
        //console.log('[MarkerManager] Configuring state mode with discrete colors');
      }
    } else {
      // Other modes - Specific configuration to be implemented as needed
      if (coordinator.debug) {
        //console.log(`[MarkerManager] Configuring mode ${mode} (pending full implementation)`);
      }
    }

    // Update style for all markers
    let updatedCount = 0;

    for (const [id, marker] of this.markerInstances.entries()) {
      const markerData = this.markers.find(m => m.id === id);
      if (markerData) {
        try {
          // Create new icon with updated mode
          const newIcon = markerRenderer.createMarkerIcon(coordinator, markerData);
          marker.setIcon(newIcon);
          updatedCount++;

          // Update popup if open
          if (marker.isPopupOpen()) {
            const lon = markerData.lon;
            const newPopupContent = markerRenderer.createMarkerPopup(markerData, lon);
            marker.setPopupContent(newPopupContent);
          }
        } catch (error) {
          console.error(`[MarkerManager] Error updating marker ${id}:`, error);
        }
      }
    }

    if (coordinator.debug) {
      //console.log(`[MarkerManager] ${updatedCount} markers updated to mode ${mode}`);
    }

    return Promise.resolve();
  },

  /**
   * Gets a marker by ID
   * @param {String} markerId - Marker ID
   * @returns {Object|null} Marker instance or null if not exists
   */
  getMarkerById(markerId) {
    return this.markerInstances.get(markerId) || null;
  },

  /**
   * Filters markers based on a filter function
   * @param {Function} filterFn - Filter function that returns true/false
   * @returns {Array} Filtered markers
   */
  filterMarkers(filterFn) {
    return this.markers.filter(filterFn);
  }
};

export default markerManager