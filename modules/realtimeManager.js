/**
 * realtimeManager.js
 * Manages real-time updates of markers
 */

import markerManager from './markerManager.js';

const realtimeManager = {
  // References
  mapCoordinator: null,
  map: null,

  // Update state
  updateTimer: null,
  lastUpdateTime: null,
  isUpdating: false,

  // Configuration
  updateInterval: 5000, // ms between updates (5 seconds default)
  retryInterval: 10000, // ms to retry after an error
  maxConsecutiveErrors: 3, // Maximum consecutive errors before pausing
  errorCount: 0, // Consecutive error counter

  /**
   * Initializes the real-time manager
   * @param {Object} coordinator - Coordinator instance
   * @param {Object} mapInstance - Leaflet map instance
   */
  initialize(coordinator, mapInstance) {
    this.mapCoordinator = coordinator;
    this.map = mapInstance;

    // Set initial interval from coordinator if exists
    if (coordinator.realtimeInterval) {
      this.updateInterval = coordinator.realtimeInterval * 1000; // Convert to ms
    }

    if (coordinator.debug) {
      //console.log('[RealtimeManager] Initialized');
    }
  },

  /**
   * Starts real-time updates
   * @param {Object} options - Configuration options
   */
  startUpdates(options = {}) {
    // Stop existing updates if any
    this.stopUpdates();

    // Update configuration if provided
    if (options.interval) {
      this.updateInterval = options.interval;
      this.mapCoordinator.realtimeInterval = options.interval / 1000; // Save in seconds
    }

    if (this.mapCoordinator.debug) {
      //console.log(`[RealtimeManager] Starting updates every ${this.updateInterval / 1000} seconds`);
    }

    // Start first update immediately
    this.scheduleNextUpdate(0);
  },

  /**
   * Stops real-time updates
   */
  stopUpdates() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    if (this.mapCoordinator.debug) {
      //console.log('[RealtimeManager] Updates stopped');
    }
  },

  /**
   * Schedules the next update
   * @param {Number} delay - Delay in ms (default is updateInterval)
   */
  scheduleNextUpdate(delay = null) {
    const nextDelay = delay !== null ? delay : this.updateInterval;

    this.updateTimer = setTimeout(() => {
      // Check if map is ready and not being interacted with
      if (this.mapCoordinator.isReady && !this.mapCoordinator.userInteracting) {
        this.performUpdate();
      } else {
        // If not ready, schedule next update
        this.scheduleNextUpdate();
      }
    }, nextDelay);
  },

  /**
   * Performs a data update
   * @param {Object} coordinator - Coordinator state (optional)
   * @param {Object} data - Data to update (optional)
   * @returns {Promise} Promise that resolves when update is complete
   */
  async performUpdate(coordinator = null, data = null) {
    // Use provided coordinator or internal one
    const coord = coordinator || this.mapCoordinator;

    // Mark as updating
    this.isUpdating = true;

    try {
      if (coord.debug) {
        //console.log('[RealtimeManager] Performing real-time update');
      }

      // If no data provided, fetch it
      if (!data) {
        data = await this.fetchUpdatedData(coord);
      }

      // If no data, do nothing
      if (!data) {
        return Promise.resolve();
      }

      // Update markers
      await markerManager.updateMarkersFromData(coord, data);

      // Update last update time
      this.lastUpdateTime = Date.now();
      coord.lastUpdateTime = this.lastUpdateTime;

      // Reset error counter
      this.errorCount = 0;

      if (coord.debug) {
        //console.log('[RealtimeManager] Update completed');
      }
    } catch (error) {
      console.error('[RealtimeManager] Error during update:', error);

      // Increment error counter
      this.errorCount++;

      // If too many consecutive errors, pause updates
      if (this.errorCount >= this.maxConsecutiveErrors) {
        console.warn(`[RealtimeManager] ${this.errorCount} consecutive errors. Pausing updates.`);
        return Promise.resolve();
      }
    } finally {
      // Mark as not updating
      this.isUpdating = false;

      // Schedule next update if no external coordinator was provided
      // (which would indicate a manual update)
      if (!coordinator && this.updateTimer) {
        this.scheduleNextUpdate();
      }
    }

    return Promise.resolve();
  },

  /**
   * Fetches updated data from the server
   * @param {Object} coordinator - Coordinator state
   * @returns {Promise} Promise that resolves with fetched data
   */
  async fetchUpdatedData(coordinator) {
    // If component has data, use it
    if (coordinator.componentInstance && coordinator.componentInstance.dataP) {
      return coordinator.componentInstance.dataP;
    }

    // If no way to get data, return null
    return null;

    // NOTE: In a real implementation, there would be an API call here
    /*
    try {
      const response = await fetch('/api/map-data');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
    */
  },

  /**
   * Changes the update interval
   * @param {Number} seconds - New interval in seconds
   */
  setUpdateInterval(seconds) {
    this.updateInterval = seconds * 1000;
    this.mapCoordinator.realtimeInterval = seconds;

    // Restart updates with new interval
    if (this.updateTimer) {
      this.stopUpdates();
      this.startUpdates();
    }

    if (this.mapCoordinator.debug) {
      //console.log(`[RealtimeManager] Interval updated to ${seconds} seconds`);
    }
  },

  /**
   * Checks if updates are in progress
   * @returns {Boolean} True if updates are active
   */
  isActive() {
    return this.updateTimer !== null;
  },

  /**
   * Forces an immediate update
   * @returns {Promise} Promise that resolves when update is complete
   */
  forceUpdate() {
    // Stop current timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    // Perform immediate update
    return this.performUpdate().then(() => {
      // Schedule next update
      this.scheduleNextUpdate();
    });
  }
};

export default realtimeManager;