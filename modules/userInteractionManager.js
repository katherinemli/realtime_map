/**
 * userInteractionManager.js
 * Manages user interactions with the map and markers
 */

import geoUtils from '../utilsMap/geoUtils.js';
import markerManager from './markerManager.js';
import markerRenderer from './markerRenderer.js';
import iconSizeUtils from '../utilsMap/iconSizeUtils.js';

const userInteractionManager = {
  // References
  mapCoordinator: null,
  map: null,

  // Interaction state
  interactionTimeout: null,
  zoomDebounceTimer: null,
  lastInteractionTime: null,
  isInteracting: false,
  isInitialLoad: true,

  // Options
  interactionDelay: 300, // ms debounce for interactions
  zoomDebounceDelay: 250, // ms debounce for zoom changes

  /**
   * Initializes the interaction manager
   * @param {Object} coordinator - Coordinator instance
   * @param {Object} mapInstance - Leaflet map instance
   */
  initialize(coordinator, mapInstance) {
    this.mapCoordinator = coordinator;
    this.map = mapInstance;

    // Initialize states
    this.isInitialLoad = true;

    // Register interaction events directly on the map
    this.setupMapEvents();

    const initialZoom = mapInstance.getZoom();
    const initialSizes = iconSizeUtils.calculateIconSizes(initialZoom);
    coordinator.iconSizes = initialSizes;

    // Calculate initial icon sizes
    this.updateIconSizes(mapInstance.getZoom());

    // After first marker load, force an icon size update
    if (coordinator.componentInstance) {
      setTimeout(() => {
        if (coordinator.isReady) {
          //console.log("Forcing initial icon size update");
          coordinator.componentInstance.queueEvent('update_icon_sizes', {
            iconSizes: initialSizes
          }, 'high');
        }
      }, 500); // Small delay to ensure markers are already created
    }

    if (coordinator.debug) {
      //console.log('[UserInteractionManager] Initialized');
    }
  },

  /**
   * Sets up map events
   */
  setupMapEvents() {
    // User events that require tracking
    this.map.on('dragstart', () => this.startUserInteraction('drag'));
    this.map.on('dragend', () => this.endUserInteraction('drag'));

    this.map.on('zoomstart', () => this.handleZoomStart());
    this.map.on('zoomend', () => this.handleZoomEnd());

    // Click to add custom markers (if implemented)
    this.map.on('click', (e) => this.handleMapClick(e));
  },

  /**
   * Marks the start of a user interaction
   * @param {String} interactionType - Type of interaction
   */
  startUserInteraction(interactionType) {
    this.isInteracting = true;
    this.lastInteractionTime = Date.now();
    this.mapCoordinator.userInteracting = true;

    // Cancel existing timeout if any
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
    }

    if (this.mapCoordinator.debug) {
      //console.log(`[UserInteractionManager] Interaction start: ${interactionType}`);
    }
  },

  /**
   * Marks the end of a user interaction
   * @param {String} interactionType - Type of interaction
   */
  endUserInteraction(interactionType) {
    // Set a timeout to consider interaction completely finished
    this.interactionTimeout = setTimeout(() => {
      this.isInteracting = false;
      this.mapCoordinator.userInteracting = false;

      // Process pending updates if any
      if (this.mapCoordinator.pendingUpdates) {
        this.processPendingUpdates();
      }

      if (this.mapCoordinator.debug) {
        //console.log(`[UserInteractionManager] Interaction end: ${interactionType}`);
      }
    }, this.interactionDelay);
  },

  /**
   * Handles zoom start event
   */
  handleZoomStart() {
    this.startUserInteraction('zoom');

    // Save current state to restore if necessary
    if (!this.isInitialLoad) {
      // Optionally close tooltips during zoom for performance
      if (this.mapCoordinator.currentTooltipState) {
        // Could implement temporary tooltip closure
      }
    }
  },

  /**
   * Handles zoom end event
   */
  handleZoomEnd() {
    // Clear previous timer if exists
    if (this.zoomDebounceTimer) {
      clearTimeout(this.zoomDebounceTimer);
    }

    // Mark initial load as complete
    if (this.isInitialLoad) {
      this.isInitialLoad = false;
    }

    // Set a timer for operations after zoom
    this.zoomDebounceTimer = setTimeout(() => {
      // Get current zoom level
      const zoomLevel = this.map.getZoom();
      //console.log("ZOOM DEBOUNCE - Current zoom level:", zoomLevel);

      // Update zoom level in coordinator
      this.mapCoordinator.currentZoom = zoomLevel;
      //console.log("Calling updateIconSizes with zoom:", zoomLevel);

      // Update icon sizes
      this.updateIconSizes(zoomLevel, true);

      // Finish zoom interaction
      this.endUserInteraction('zoom');
    }, this.zoomDebounceDelay);
  },

  /**
   * Updates icon sizes based on zoom level
   * @param {Number} zoomLevel - Current zoom level
   * @param {Boolean} forceUpdate - Whether to force update regardless of changes
   */
  updateIconSizes(zoomLevel, forceUpdate = false) {
    //console.log("[UserInteractionManager] Evaluating size change for zoom:", zoomLevel);

    // Calculate new sizes
    const newSizes = iconSizeUtils.calculateIconSizes(zoomLevel);

    // Determine if sizes have changed
    const currentSizes = this.mapCoordinator.iconSizes;

    // Manual comparison to avoid reference issues
    let sizesChanged = forceUpdate;

    if (!sizesChanged && currentSizes && newSizes) {
      // Specifically compare sizes
      sizesChanged = (
        currentSizes.icon.size[0] !== newSizes.icon.size[0] ||
        currentSizes.icon.size[1] !== newSizes.icon.size[1] ||
        currentSizes.satellite.size[0] !== newSizes.satellite.size[0] ||
        currentSizes.satellite.size[1] !== newSizes.satellite.size[1]
      );
    }

    if (!sizesChanged) {
      //console.log("[UserInteractionManager] No size changes, skipping update");
      return; // No change, do nothing
    }

    //console.log("[UserInteractionManager] Change detected:",`${currentSizes?.icon.size[0]}x${currentSizes?.icon.size[1]} -> ${newSizes.icon.size[0]}x${newSizes.icon.size[1]}`);

    // Create explicit copies of arrays to avoid reference issues
    const newSizesCopy = {
      icon: {
        size: [...newSizes.icon.size],
        anchor: [...newSizes.icon.anchor],
        popupAnchor: [...newSizes.icon.popupAnchor]
      },
      satellite: {
        size: [...newSizes.satellite.size],
        anchor: [...newSizes.satellite.anchor],
        popupAnchor: [...newSizes.satellite.popupAnchor]
      }
    };

    // Update sizes in coordinator
    this.mapCoordinator.iconSizes = newSizesCopy;

    if (this.mapCoordinator.debug) {
      //console.log(`[UserInteractionManager] Icon sizes updated for zoom ${zoomLevel}: ${newSizes.icon.size[0]}x${newSizes.icon.size[1]}`);
    }

    // Request icon size update through event system
    this.mapCoordinator.componentInstance.queueEvent('update_icon_sizes', {
      iconSizes: newSizesCopy
    }, 'high');

    // Clear icon cache to force regeneration
    if (forceUpdate && markerRenderer && typeof markerRenderer.clearIconCache === 'function') {
      markerRenderer.clearIconCache();
      //console.log('[UserInteractionManager] Icon cache cleared to force regeneration');
    }
  },

  /**
     * Processes pending updates after an interaction
     */
  processPendingUpdates() {
    // Check if there are pending updates
    if (this.mapCoordinator.pendingUpdates && this.mapCoordinator.componentInstance) {
      const component = this.mapCoordinator.componentInstance;

      // Reset state
      this.mapCoordinator.pendingUpdates = false;

      // Queue update event
      component.queueEvent('data_update', { data: component.dataP }, 'normal');
    }
  },

  /**
   * Applies icon size update to existing markers
   * @param {Object} coordinator - Coordinator state
   * @param {Object} iconSizes - Size configuration
   * @returns {Promise} Promise that resolves when update is complete
   */
  async applyIconSizeUpdate(coordinator, iconSizes) {
    //console.log("APPLYING icon size update with sizes:", iconSizes.icon.size);
    try {
      // Request markerManager to update all icons
      await markerManager.updateAllIconSizes(coordinator, iconSizes);
    } catch (error) {
      console.error('[UserInteractionManager] Error updating icon sizes:', error);
    }

    return Promise.resolve();
  },

  /**
   * Handles zoom level changes
   * @param {Object} coordinator - Coordinator state
   * @param {Number} zoom - New zoom level
   * @returns {Promise} Promise that resolves when handling is complete
   */
  async handleZoomChange(coordinator, zoom) {
    // Save previous zoom level
    const prevZoom = coordinator.previousZoom !== null ? coordinator.previousZoom : zoom;

    // Update zoom level in coordinator
    coordinator.currentZoom = zoom;

    //console.log(`[UserInteractionManager] Zoom change: ${prevZoom} -> ${zoom}`);

    // Define specific thresholds where sizes change
    const sizeThresholds = [5, 7, 10, 13];

    // Check if we cross any threshold
    let forceSizeUpdate = false;

    for (const threshold of sizeThresholds) {
      if ((prevZoom < threshold && zoom >= threshold) ||
        (prevZoom >= threshold && zoom < threshold)) {
        forceSizeUpdate = true;
        //console.log(`[UserInteractionManager] Zoom threshold crossed: ${prevZoom} -> ${zoom} at threshold ${threshold}`);
        break;
      }
    }

    // Force update if we cross a threshold
    if (forceSizeUpdate) {
      //console.log(`[UserInteractionManager] Zoom threshold crossed: ${prevZoom} -> ${zoom}, forcing icon update`);
      this.updateIconSizes(zoom, true);
    }

    // Save current zoom as previous for next time
    coordinator.previousZoom = zoom;

    // Threshold for display mode change
    const clusterThreshold = 8;

    // Automatically change cluster mode based on zoom
    if (zoom <= clusterThreshold && prevZoom > clusterThreshold) {
      // Activate clusters in distant zoom
      if (!coordinator.currentMarkerMode.includes('cluster')) {
        const newMode = coordinator.currentMarkerMode + '_cluster';
        await markerManager.updateMarkerMode(coordinator, newMode);
      }
    } else if (zoom > clusterThreshold && prevZoom <= clusterThreshold) {
      // Deactivate clusters in close zoom
      if (coordinator.currentMarkerMode.includes('cluster')) {
        const newMode = coordinator.currentMarkerMode.replace('_cluster', '');
        await markerManager.updateMarkerMode(coordinator, newMode);
      }
    }

    return Promise.resolve();
  },

  /**
   * Handles changes in map visible bounds
   * @param {Object} coordinator - Coordinator state
   * @param {Object} bounds - New bounds
   * @returns {Promise} Promise that resolves when handling is complete
   */
  async handleBoundsChange(coordinator, bounds) {
    // Update current bounds
    coordinator.currentBounds = bounds;

    // If bounds filtering is active, apply it
    if (coordinator.filterByBounds) {
      const standardBounds = geoUtils.convertLeafletBounds(bounds);

      // Filter markers by visibility
      // Could be used to dynamically load/unload markers
      // based on current view
    }

    return Promise.resolve();
  },

  /**
   * Handles map center changes
   * @param {Object} coordinator - Coordinator state
   * @param {Object} center - New center
   * @returns {Promise} Promise that resolves when handling is complete
   */
  async handleCenterChange(coordinator, center) {
    // Update current center
    coordinator.currentCenter = center;

    return Promise.resolve();
  },

  /**
   * Handles map clicks
   * @param {Object} e - Click event
   */
  handleMapClick(e) {
    // If there's an active mode requiring map click
    // For example, to add custom markers
    const coord = e.latlng;

    if (this.mapCoordinator.debug) {
      //console.log(`[UserInteractionManager] Map click: ${coord.lat}, ${coord.lng}`);
    }

    // Queue event if a mode requires it
    if (this.mapCoordinator.currentMode === 'add_marker' &&
      this.mapCoordinator.componentInstance) {
      this.mapCoordinator.componentInstance.queueEvent('map_click', {
        lat: coord.lat,
        lon: coord.lng
      }, 'high');
    }
  },

  /**
   * Handles marker clicks
   * @param {Object} coordinator - Coordinator state
   * @param {String} markerId - Marker ID
   * @returns {Promise} Promise that resolves when handling is complete
   */
  async handleMarkerClick(coordinator, markerId) {
    // Get the marker
    const marker = markerManager.getMarkerById(markerId);

    if (!marker) {
      return Promise.resolve();
    }

    // Get marker data
    const markerData = markerManager.markers.find(m => m.id === markerId);

    // Custom actions on marker click
    // For example, show detailed information, change state, etc.

    if (coordinator.debug) {
      //console.log(`[UserInteractionManager] Marker click: ${markerId}`, markerData);
    }

    return Promise.resolve();
  },

  /**
   * Handles hover events on markers
   * @param {Object} coordinator - Coordinator state
   * @param {String} markerId - Marker ID
   * @param {Boolean} isEntering - If cursor is entering (true) or leaving (false)
   * @returns {Promise} Promise that resolves when handling is complete
   */
  async handleMarkerHover(coordinator, markerId, isEntering) {
    // Get the marker
    const marker = markerManager.getMarkerById(markerId);

    if (!marker) {
      return Promise.resolve();
    }

    // Actions when hovering over a marker
    if (isEntering) {
      // For example, highlight the marker
      marker.setZIndexOffset(1000); // Bring to front

      // Show tooltip if not automatically configured
    } else {
      // Restore normal state
      marker.setZIndexOffset(0);
    }

    return Promise.resolve();
  },

  /**
   * Handles various map interactions
   * @param {Object} coordinator - Coordinator state
   * @param {String} eventType - Event type ('user_zoom_change', etc.)
   * @param {Object} data - Event data
   * @returns {Promise} Promise that resolves when handling is complete
   */
  async handleMapInteraction(coordinator, eventType, data) {
    switch (eventType) {
      case 'user_zoom_change':
        await this.handleZoomChange(coordinator, data.zoom);
        break;

      case 'user_bounds_change':
        await this.handleBoundsChange(coordinator, data.bounds);
        break;

      case 'user_center_change':
        await this.handleCenterChange(coordinator, data.center);
        break;

      case 'marker_click':
        await this.handleMarkerClick(coordinator, data.markerId);
        break;

      case 'marker_hover':
        await this.handleMarkerHover(coordinator, data.markerId, data.isEntering);
        break;

      case 'update_icon_sizes':
        await this.applyIconSizeUpdate(coordinator, data.iconSizes);
        break;
    }

    return Promise.resolve();
  }
};

export default userInteractionManager;