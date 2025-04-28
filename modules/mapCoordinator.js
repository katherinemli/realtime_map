/**
 * mapCoordinator.js
 * Main coordinator that manages map event flow and states
 */

import iconSizeUtils from '../utilsMap/iconSizeUtils.js';

const mapCoordinator = {
  /**
   * Creates a new coordinator state
   * @returns {Object} Initial coordinator state
   */
  createCoordinator() {
    return {
      // Map state
      state: 'initializing',   // Current map state
      isReady: false,          // If map is fully initialized
      userInteracting: false,  // If user is interacting with the map
      pendingUpdates: false,   // If there are pending updates
      lastUpdateTime: null,    // Last time the map was updated
      realtimeInterval: 5,     // Update interval in seconds
      currentMarkerMode: 'num_state', // Current marker mode
      currentZoom: 5,          // Current zoom level
      previousZoom: null,      // Previous zoom level

      // Icon settings
      iconSizes: iconSizeUtils.calculateIconSizes(5), // Initial sizes for zoom 5

      // Tooltip state
      currentTooltipState: false, // If tooltips are activated
      tooltipStateBeforeZoom: false, // Tooltip state before zoom

      errorInfo: {             // Error information
        code: 0,
        message: ''
      },
      debug: true,             // Enable debug logs

      // Event system
      currentEvent: {
        type: null,            // Current event type
        action: null,          // Specific action being executed
        startTime: null,       // Start time
        isInterruptible: true, // If it can be interrupted
        progress: 0,           // Progress (0-100%)
        data: null             // Relevant event data
      },
      eventQueue: [],          // Pending events queue
      lastUserEvent: {         // Last user event
        type: null,
        timestamp: null,
        data: null
      },

      // References to other components
      mapInstance: null,       // Leaflet map instance
      componentInstance: null, // Vue component instance
    };
  },

  /**
   * Registers events and sets references
   * @param {Object} componentInstance - Vue component instance
   */
  registerEvents(componentInstance) {
    componentInstance.mapCoordinator.componentInstance = componentInstance;
  },

  /**
   * Clears registered events
   * @param {Object} componentInstance - Vue component instance
   */
  unregisterEvents(componentInstance) {
    componentInstance.mapCoordinator.componentInstance = null;
  },

  /**
   * Queues a new event to be processed
   * @param {Object} coordinator - Coordinator state
   * @param {String} eventType - Event type
   * @param {Object} eventData - Associated event data
   * @param {String} priority - Event priority ('high', 'normal', 'low')
   */
  queueEvent(coordinator, eventType, eventData, priority = 'normal') {
    if (coordinator.debug) {
      //console.log(`[MapCoordinator] Queuing event: ${eventType}`, eventData);
    }
    // If it's a critical event, always interrupt current action
    if (priority === 'critical') {
      // If there's an ongoing event, save it to resume later
      if (coordinator.currentEvent.type) {
        const interruptedEvent = { ...coordinator.currentEvent };
        coordinator.eventQueue.unshift({
          type: interruptedEvent.type,
          data: interruptedEvent.data,
          priority: interruptedEvent.priority || 'normal',
          timestamp: Date.now()
        });
      }

      // Cancel timers if it's a marker mode change
      if (eventType === 'update_marker_mode') {
        import('./realtimeManager.js').then(module => {
          module.default.stopUpdates();
        });
      }

      // Start critical event immediately
      this.startEvent(coordinator, eventType, eventData, priority);
      return;
    }
    // If no event is running, start immediately
    if (!coordinator.currentEvent.type) {
      this.startEvent(coordinator, eventType, eventData);
      return;
    }

    // Determine if we should interrupt current event
    if ((priority === 'high' || eventType.startsWith('user_')) &&
      coordinator.currentEvent.isInterruptible) {

      // Save current event to resume later
      const interruptedEvent = { ...coordinator.currentEvent };
      coordinator.eventQueue.unshift({
        type: interruptedEvent.type,
        data: interruptedEvent.data,
        priority: 'high', // To ensure it's resumed soon
        timestamp: Date.now()
      });

      // Start new high-priority event
      this.startEvent(coordinator, eventType, eventData);
    } else {
      // Add to queue with specified priority
      coordinator.eventQueue.push({
        type: eventType,
        data: eventData,
        priority: priority,
        timestamp: Date.now()
      });

      if (eventType.startsWith('user_')) {
        // Update last user event
        coordinator.lastUserEvent = {
          type: eventType,
          timestamp: Date.now(),
          data: eventData
        };
      }
    }
  },

  /**
   * Starts event execution
   * @param {Object} coordinator - Coordinator state
   * @param {String} eventType - Event type
   * @param {Object} eventData - Associated event data
   */
  startEvent(coordinator, eventType, eventData, priority = 'normal') {
    if (coordinator.debug) {
      //console.log(`[MapCoordinator] Starting event: ${eventType} with priority ${priority}`, eventData);
    }
    
    // Configure current event with priority
    coordinator.currentEvent = {
      type: eventType,
      action: this.determineAction(coordinator, eventType, eventData),
      startTime: Date.now(),
      isInterruptible: this.isEventInterruptible(eventType),
      priority: priority,
      progress: 0,
      data: eventData
    };
    
    // Execute corresponding action
    this.executeEvent(coordinator);
  },

  /**
   * Determines what action corresponds to an event type
   * @param {Object} coordinator - Coordinator state
   * @param {String} eventType - Event type
   * @param {Object} eventData - Associated event data
   * @returns {String} Name of action to execute
   */
  determineAction(coordinator, eventType, eventData) {
    // Event to action mapping
    const eventActionMap = {
      'data_update': 'updateMap',
      'process_markers': 'processMarkers',
      'user_zoom_change': 'handleZoomChange',
      'user_bounds_change': 'handleBoundsChange',
      'user_center_change': 'handleCenterChange',
      'marker_click': 'handleMarkerClick',
      'marker_hover': 'handleMarkerHover',
      'realtime_update': 'handleRealtimeUpdate',
      'update_icon_sizes': 'updateIconSizes',
      'update_tooltip_state': 'updateTooltipState',
      'update_marker_mode': 'updateMarkerMode'
    };

    return eventActionMap[eventType] || 'unknownAction';
  },

  /**
   * Determines if an event can be interrupted
   * @param {String} eventType - Event type
   * @returns {Boolean} If the event is interruptible
   */
  isEventInterruptible(eventType) {
    // Events that should not be interrupted under normal circumstances
    const nonInterruptibleEvents = [
      'initialization',
      'error_handling'
    ];

    // However, critical events can interrupt even these
    if (this.currentEvent && this.currentEvent.priority === 'critical') {
      return true;
    }

    return !nonInterruptibleEvents.includes(eventType);
  },

  /**
   * Executes the action corresponding to the current event
   * @param {Object} coordinator - Coordinator state
   */
  executeEvent(coordinator) {
    const { type, action, data } = coordinator.currentEvent;
    const component = coordinator.componentInstance;

    if (!component) {
      console.error('[MapCoordinator] No component instance available');
      this.eventCompleted(coordinator);
      return;
    }

    // Invoke method corresponding to event type
    switch (type) {
      case 'data_update':
        // Use markerManager module to update map
        import('./markerManager.js').then(module => {
          module.default.updateMarkersFromData(coordinator, data.data)
            .then(() => this.eventCompleted(coordinator))
            .catch(error => {
              console.error('[MapCoordinator] Error in data_update:', error);
              this.handleEventError(coordinator, error);
            });
        });
        break;

      case 'process_markers':
        // Use markerManager module to process markers
        import('./markerManager.js').then(module => {
          module.default.processMarkers(coordinator, data.markers)
            .then(() => this.eventCompleted(coordinator))
            .catch(error => {
              console.error('[MapCoordinator] Error in process_markers:', error);
              this.handleEventError(coordinator, error);
            });
        });
        break;

      case 'update_icon_sizes':
        // Use userInteractionManager to update icon sizes
        import('./userInteractionManager.js').then(module => {
          module.default.applyIconSizeUpdate(coordinator, data.iconSizes)
            .then(() => this.eventCompleted(coordinator))
            .catch(error => {
              console.error('[MapCoordinator] Error in update_icon_sizes:', error);
              this.handleEventError(coordinator, error);
            });
        });
        break;

      case 'update_tooltip_state':
        // Use markerManager to update tooltip state
        import('./markerManager.js').then(module => {
          module.default.updateTooltipState(coordinator, data.enabled)
            .then(() => this.eventCompleted(coordinator))
            .catch(error => {
              console.error('[MapCoordinator] Error in update_tooltip_state:', error);
              this.handleEventError(coordinator, error);
            });
        });
        break;

      case 'update_marker_mode':
        // Use markerManager to update marker mode
        import('./markerManager.js').then(module => {
          module.default.updateMarkerMode(coordinator, data.mode)
            .then(() => this.eventCompleted(coordinator))
            .catch(error => {
              console.error('[MapCoordinator] Error in update_marker_mode:', error);
              this.handleEventError(coordinator, error);
            });
        });
        break;

      case 'user_zoom_change':
      case 'user_bounds_change':
      case 'user_center_change':
        // Use userInteractionManager to handle interactions
        import('./userInteractionManager.js').then(module => {
          module.default.handleMapInteraction(coordinator, type, data)
            .then(() => this.eventCompleted(coordinator))
            .catch(error => {
              console.error(`[MapCoordinator] Error in ${type}:`, error);
              this.handleEventError(coordinator, error);
            });
        });
        break;

      case 'realtime_update':
        // Use realtimeManager for real-time updates
        import('./realtimeManager.js').then(module => {
          module.default.performUpdate(coordinator, data)
            .then(() => this.eventCompleted(coordinator))
            .catch(error => {
              console.error('[MapCoordinator] Error in realtime_update:', error);
              this.handleEventError(coordinator, error);
            });
        });
        break;

      default:
        console.warn(`[MapCoordinator] Unknown event type: ${type}`);
        this.eventCompleted(coordinator);
    }
  },

  /**
   * Marks an event as completed and processes the next in queue
   * @param {Object} coordinator - Coordinator state
   */
  eventCompleted(coordinator) {
    if (coordinator.debug) {
      //console.log(`[MapCoordinator] Event completed: ${coordinator.currentEvent.type}`);
    }

    // Reset current event
    coordinator.currentEvent = {
      type: null,
      action: null,
      startTime: null,
      isInterruptible: true,
      progress: 0,
      data: null
    };

    // Process next event in queue if it exists
    if (coordinator.eventQueue.length > 0) {
      // Sort by priority
      coordinator.eventQueue.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        return 0;
      });

      const nextEvent = coordinator.eventQueue.shift();
      this.startEvent(coordinator, nextEvent.type, nextEvent.data);
    }
  },

  /**
   * Handles errors during event execution
   * @param {Object} coordinator - Coordinator state
   * @param {Error} error - Error occurred
   */
  handleEventError(coordinator, error) {
    coordinator.errorInfo = {
      code: 500,
      message: `Error in event ${coordinator.currentEvent.type}: ${error.message}`
    };
    coordinator.state = 'error';

    // Complete event with error to continue with the next
    this.eventCompleted(coordinator);
  },

  /**
   * Updates progress of an ongoing event
   * @param {Object} coordinator - Coordinator state
   * @param {Number} progress - Percentage of progress (0-100)
   */
  updateEventProgress(coordinator, progress) {
    coordinator.currentEvent.progress = progress;

    if (coordinator.debug && progress % 25 === 0) {
      //console.log(`[MapCoordinator] Progress of ${coordinator.currentEvent.type}: ${progress}%`);
    }
  }
};

export default mapCoordinator;