/**
 * markerRenderer.js
 * Manages marker rendering, including icons and popups
 */

import L from 'leaflet';
import iconFactory from '../utilsMap/iconFactory.js';

const markerRenderer = {
  // References
  mapCoordinator: null,
  map: null,
  componentInstance: null, // To access component methods like $const

  // Icon cache to improve performance
  iconCache: new Map(),

  /**
   * Initializes the renderer
   * @param {Object} coordinator - Coordinator instance
   * @param {Object} mapInstance - Leaflet map instance
   * @param {Object} component - Vue component instance (to access $const)
   */
  initialize(coordinator, mapInstance, component) {
    this.mapCoordinator = coordinator;
    this.map = mapInstance;
    this.componentInstance = component;

    // Clear cache on initialization
    this.iconCache.clear();

    if (coordinator.debug) {
      ////console.log('[MarkerRenderer] Initialized');
    }
  },

  /**
   * Creates an icon for a marker
   * @param {Object} coordinator - Coordinator state
   * @param {Object} markerData - Marker data
   * @param {Object} iconSizes - Size configuration (optional)
   * @returns {Object} Leaflet icon
   */
  createMarkerIcon(coordinator, markerData, iconSizes = null) {
    // Use provided sizes or coordinator's sizes
    const sizes = iconSizes || coordinator.iconSizes;

    // Determine if it's a satellite or regular marker
    const isSatellite = markerData.type === 'satellite';
    const iconConfig = isSatellite ? sizes.satellite : sizes.icon;

    // Determine marker color based on mode
    let fillColor;

    // Determine color based on marker mode
    ////console.log(`%c createMarkerIcon: ${coordinator.currentMarkerMode}`, 'background: #222; color: #bada55');
    if (coordinator.currentMarkerMode === 'num_state') {
      // State mode - Use specific state color from constant
      fillColor = this.getMarkerColor(markerData.var, coordinator);
    } else {
      // Other modes - Use interpolation based on value
      const modeMax = coordinator.markerModeMax || 100;
      fillColor = this.getValueColor(markerData.var, modeMax, coordinator.currentMarkerMode);
    }
    // Create unique cache key including size and color
    const sizeKey = `${iconConfig.size[0]}x${iconConfig.size[1]}`;
    const colorKey = fillColor.replace('#', '');
    const modeKey = coordinator.currentMarkerMode || 'num_state';
    const cacheKey = `${markerData.id}_${markerData.iconNumber}_${colorKey}_${modeKey}_${sizeKey}`;

    if (!(this.iconCache instanceof Map)) {
      // If iconCache is not a Map, reinitialize it
      console.warn('[MarkerRenderer] iconCache is not a Map, reinitializing...');
      this.iconCache = new Map();
    }

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey);
    }

    // Get the original SVG element
    const iconElement = document.getElementById('icon_' + markerData.iconNumber);

    if (!iconElement) {
      // Fallback to circle if icon not found
      const size = Math.max(parseInt(iconConfig.size[0], 10), 12);
      const svgCircle = `
       <svg xmlns="http://www.w3.org/2000/svg" 
            width="${size}" 
            height="${size}" 
            viewBox="0 0 ${size} ${size}">
         <circle cx="${size / 2}" 
                 cy="${size / 2}" 
                 r="${size / 2 - 2}" 
                 fill="${fillColor}" 
                 stroke="white" 
                 stroke-width="2"/>
       </svg>
     `;

      const fallbackIcon = L.divIcon({
        className: 'custom-marker',
        html: svgCircle,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
      });

      // Save in cache
      this.iconCache.set(cacheKey, fallbackIcon);

      return fallbackIcon;
    }

    // Get the original SVG's viewBox to maintain proportion
    const originalViewBox = iconElement.getAttribute('viewBox') || "0 0 24 24";

    // Determine final size (ensure numeric values)
    const width = parseInt(iconConfig.size[0], 10);
    const height = parseInt(iconConfig.size[1], 10);

    // Get path from original icon
    const pathElement = iconElement.querySelector('path');
    const pathD = pathElement ? pathElement.getAttribute('d') : '';

    // SOLUTION: Create a new SVG instead of cloning the existing one
    // IMPORTANT: Use original viewBox but adjust size according to zoom
    const svgString = `
     <svg xmlns="http://www.w3.org/2000/svg" 
          width="${width}" 
          height="${height}" 
          viewBox="${originalViewBox}"
          preserveAspectRatio="xMidYMid meet">
       <path fill="${fillColor}" d="${pathD}" />
     </svg>
   `;

    // Create divIcon with SVG
    const icon = L.divIcon({
      className: 'custom-marker',
      html: svgString,
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2],
      popupAnchor: [0, -height / 2]
    });

    // Save in cache
    this.iconCache.set(cacheKey, icon);

    if (coordinator.debug) {
      ////console.log(`[MarkerRenderer] Created icon for ${markerData.id} with size ${width}x${height} and color ${fillColor} (mode: ${modeKey})`);
    }

    return icon;
  },

  /**
   * Creates popup HTML content for a marker
   * @param {Object} markerData - Marker data
   * @param {Number} lon - Normalized longitude
   * @returns {String} Popup HTML content
   */
  createMarkerPopup(markerData, lon) {
    // Determine specific HTML for state based on marker mode
    let htmlString;
    let hexColor = '#777'; // Default gray color

    // Determine if we're in num_state mode
    const isNumStateMode = this.mapCoordinator &&
      this.mapCoordinator.currentMarkerMode === 'num_state';

    // Get appropriate color based on mode
    if (isNumStateMode) {
      // For state mode - Get from centralized function
      hexColor = this.getMarkerColor(markerData.var, this.mapCoordinator);
    } else {
      // For other modes - Color based on value and maximum
      const modeMax = this.mapCoordinator && this.mapCoordinator.markerModeMax ?
        this.mapCoordinator.markerModeMax : 100;
      hexColor = this.getValueColor(markerData.var, modeMax);
    }

    if (isNumStateMode) {
      // Get state text for state mode
      let stateName = 'Unknown';

      // Try to get state text from different sources
      if (this.componentInstance) {
        if (this.componentInstance.statesmap && this.componentInstance.statesmap.IdToState) {
          // From statesmap prop
          stateName = this.componentInstance.statesmap.IdToState[markerData.var] || 'Unknown';
        } else if (this.componentInstance.$const && this.componentInstance.$const('nms_id_to_state')) {
          // From $const nms_id_to_state
          stateName = this.componentInstance.$const('nms_id_to_state')[markerData.var] || 'Unknown';
        } else {
          // Default states
          const defaultStates = {
            0: 'Normal',
            1: 'Warning',
            2: 'Alert',
            3: 'Critical',
            4: 'Unreachable',
            5: 'Unknown',
            6: 'Special',
            7: 'Maintenance',
            8: 'Inactive',
            9: 'Testing'
          };
          stateName = defaultStates[markerData.var] || 'Unknown';
        }
      }

      // Apply color directly inline + keep CSS class for compatibility
      htmlString = `<div class="marker__state marker__state--${markerData.var}" style="background-color: ${hexColor};">${stateName}</div>`;
    } else {
      // For non-num_state modes
      const markerModeName = this.mapCoordinator && this.mapCoordinator.markerModeName ?
        this.mapCoordinator.markerModeName : 'state';
      const markerModeUnits = this.mapCoordinator && this.mapCoordinator.markerModeUnits ?
        this.mapCoordinator.markerModeUnits : '';

      // Use $t for translation if available
      const translatedText = this.componentInstance && this.componentInstance.$t ?
        this.componentInstance.$t(`map.${markerModeName}`) :
        `map.${markerModeName}`;

      // Apply color directly
      htmlString = `<div class="marker__state" style="background-color: ${hexColor};">${translatedText} : ${markerData.var.toFixed(1)}${markerModeUnits}</div>`;
    }

    // Format coordinates if function is available
    let coordsString = '';

    if (this.componentInstance && typeof this.componentInstance.positionFormatter === 'function') {
      try {
        const latFormatted = this.componentInstance.positionFormatter(markerData.lat, 'N ', 'S ');
        const lonFormatted = this.componentInstance.positionFormatter(lon, 'E ', 'W ');
        coordsString = `Lat: ${latFormatted}, Lon: ${lonFormatted};`;
      } catch (error) {
        console.warn('[MarkerRenderer] Error formatting coordinates:', error);
        coordsString = `Lat: N ${markerData.lat.toFixed(6)}, Lon: W ${lon.toFixed(6)};`;
      }
    } else {
      // Simple format if formatter unavailable
      coordsString = `Lat: N ${markerData.lat.toFixed(6)}, Lon: W ${lon.toFixed(6)};`;
    }

    // Determine URL for dashboard link
    let dashboardUrl = '#';
    let routerUrl = '/';

    if (markerData.type && markerData.id) {
      dashboardUrl = `${document.location.origin}/object/dashboard/${markerData.type}=${markerData.id}`;
      routerUrl = `/object/dashboard/${markerData.type}=${markerData.id}`;
    }

    // Basic CSS style for popup (Only generic styles)
    const cssStyle = `
      <style>
        .marker__popup {
          font-family: sans-serif;
          min-width: 200px;
        }
        .marker__row {
          margin-bottom: 5px;
          clear: both;
          overflow: hidden;
        }
        .marker__link {
          color: #0078A8;
          text-decoration: none;
          font-weight: bold;
          float: left;
        }
        .marker__link:hover {
          text-decoration: underline;
        }
        .marker__state {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          color: white;
          font-weight: bold;
          float: right;
        }
        .marker__weather {
          background-color: #f8f8f8;
          border: 1px solid #ddd;
          padding: 3px 8px;
          cursor: pointer;
          border-radius: 3px;
        }
        .marker__weather:hover {
          background-color: #eee;
        }
        .marker__row--capitalize {
          text-transform: capitalize;
        }
      </style>
    `;

    // Create full popup HTML in original format
    return `${cssStyle}
            <div class="marker__popup">
              <div class="marker__row">
                <a href="${dashboardUrl}" url="${routerUrl}" class="marker__link">${markerData.name || 'Marker ' + markerData.i}</a>
                ${htmlString}
              </div>
              <div class="marker__row">
                ${coordsString}
              </div>
              <div class="marker__row marker__row--weather"></div>
              <div class="marker__row">
                <button value="${markerData.name || 'Marker ' + markerData.i}" class="marker__weather">Request weather</button>
              </div>
            </div>`;
  },

  /**
     * Generates HTML for tooltip (shown on hover)
     * @param {Object} markerData - Marker data
     * @returns {String} Tooltip HTML content
     */
  createMarkerTooltip(markerData) {
    return `<div class="marker__tooltip">${markerData.name || 'Marker ' + markerData.i}</div>`;
  },

  /**
   * Gets descriptive text for a state
   * @param {Number} state - State value
   * @returns {String} Descriptive text
   */
  getStateText(state) {
    // Try to get text from component configuration
    if (this.componentInstance && this.componentInstance.statesmap &&
      this.componentInstance.statesmap.IdToState) {
      return this.componentInstance.statesmap.IdToState[state] || 'Unknown';
    } else if (this.componentInstance && this.componentInstance.$const &&
      this.componentInstance.$const('nms_states_text')) {
      try {
        return this.componentInstance.$const('nms_states_text')[state];
      } catch (error) {
        console.warn('[MarkerRenderer] Error getting state text:', error);
      }
    }

    // Fallback state texts
    const stateTexts = {
      0: 'Normal',
      1: 'Warning',
      2: 'Alert',
      3: 'Critical',
      4: 'Unreachable',
      5: 'Special'
    };

    return stateTexts[state] || 'Unknown';
  },

  /**
   * Gets color for a specific state
   * @param {Number} state - State value
   * @param {Object} coordinator - Coordinator state (optional)
   * @returns {String} Color in hex format
   */
  getMarkerColor(state, coordinator = null) {
    // Priority 1: Get from coordinator if exists
    if (coordinator && coordinator.stateColors && coordinator.stateColors[state] !== undefined) {
      return coordinator.stateColors[state];
    }
    // Priority 2: Get from component configuration
    if (this.componentInstance && this.componentInstance.$const) {
      try {
        const stateColors = this.componentInstance.$const('nms_states_white_numeric');
        if (stateColors && stateColors[state] !== undefined) {
          return stateColors[state];
        }
      } catch (error) {
        console.warn('[MarkerRenderer] Error getting state color from $const:', error);
      }
    }

    // Priority 3: Predefined fallback colors
    const stateColors = {
      0: '#5cb85c', // Normal - Green
      1: '#f0ad4e', // Warning - Yellow
      2: '#ff9900', // Alert - Orange
      3: '#d9534f', // Critical - Red
      4: '#d9534f', // Unreachable - Red
      5: '#9900cc', // Special - Purple
      6: '#0275d8', // Maintenance - Blue
      7: '#777777', // Inactive - Gray
      8: '#5bc0de', // Testing - Cyan
      9: '#292b2c'  // Unknown - Black
    };

    return stateColors[state] || '#777777';
  },

  /**
  * Gets color based on a continuous value and maximum
  * @param {Number} value - Current value
  * @param {Number} maxValue - Maximum value
  * @param {String} mode - Interpolation mode ('default', 'reverse', 'custom')
  * @returns {String} Color in hex format
  */
  getValueColor(value, maxValue, mode = 'default') {
    // Ensure valid values
    const safeValue = isNaN(value) ? 0 : value;
    const safeMax = isNaN(maxValue) || maxValue <= 0 ? 100 : maxValue;

    // Calculate fraction (between 0 and 1)
    let fraction = Math.max(0, Math.min(1, safeValue / safeMax));

    // Invert if necessary
    if (mode === 'reverse') {
      fraction = 1 - fraction;
    }

    // Check if we're in a specific mode
    if (this.mapCoordinator && this.mapCoordinator.currentMarkerMode) {
      // Adjust color scheme based on mode
      if (this.mapCoordinator.currentMarkerMode === 'num_state') {
        return this.getMarkerColor(value, this.mapCoordinator);
      }
    }

    // Interpolation from red to green via yellow
    let r, g, b;
    if (fraction < 0.5) {
      // From red to yellow
      r = 255;
      g = Math.round(255 * (fraction * 2));
      b = 0;
    } else {
      // From yellow to green
      r = Math.round(255 * (1 - (fraction - 0.5) * 2));
      g = 255;
      b = 0;
    }

    // Convert to hex format
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  },

  /**
  * Clears icon cache
  * @param {Boolean} forceComplete - If complete cleanup should be performed
  */
  clearIconCache(forceComplete = false) {
    ////console.log('[MarkerRenderer] Clearing icon cache...');

    // Ensure iconCache is a Map
    if (!(this.iconCache instanceof Map)) {
      this.iconCache = new Map();
    }

    // Clear cache
    this.iconCache.clear();
    ////console.log('[MarkerRenderer] Icon cache cleared');

    // If complete cleanup is requested
    if (forceComplete) {
      // Clear other caches if they exist
      if (this.canvasCache instanceof Map) {
        this.canvasCache.clear();
      } else if (this.canvasCache) {
        this.canvasCache = {};
      }

      if (this.gradientCache instanceof Map) {
        this.gradientCache.clear();
      } else if (this.gradientCache) {
        this.gradientCache = {};
      }

      if (this.fontCache instanceof Map) {
        this.fontCache.clear();
      } else if (this.fontCache) {
        this.fontCache = {};
      }

      // Remove any cached DOM elements
      const cachedElements = document.querySelectorAll('.cached-icon-element');
      cachedElements.forEach(el => el.remove());

      ////console.log('[MarkerRenderer] Icon cache completely cleared');
    }
  },

  /**
  * Sets up popup events to handle button and link clicks
  * @param {Object} marker - Leaflet marker
  */
  setupPopupEvents(marker) {
    if (!marker) return;

    // Ensure events are configured only once
    if (marker._hasPopupEvents) return;

    marker.on('popupopen', (event) => {
      const popupNode = event.popup;
      if (!popupNode || !popupNode._contentNode) return;

      // Configure popup click event
      popupNode._contentNode.addEventListener('click', (e) => {
        // If it's the weather request button
        if (e.target.classList.contains('marker__weather')) {
          const parent = e.target.parentNode;
          const popup = parent.parentNode;
          const weatherRow = popup.querySelector('.marker__row--weather');

          if (this.componentInstance && typeof this.componentInstance.requestWeatherInPoint === 'function') {
            let lng = popupNode._latlng.lng;
            // Normalize longitude
            if (lng > 180) {
              lng = lng - 360;
            } else if (lng < -180) {
              lng = lng + 360;
            }

            // Call component method to get weather
            this.componentInstance.requestWeatherInPoint(
              popupNode._latlng.lat, lng
            ).then(r => {
              if (r && weatherRow) {
                weatherRow.innerHTML = `
              <p class="marker__row--capitalize">Weather: ${r.weather}</p>
              <p>Temperature: ${parseInt(r.temperature - 273)}&deg;C</p>
              <p>Pressure: ${r.pressure} hPa</p>
              <p>Wind speed: ${r.windSpeed} m/s</p>
              <p>Wind direction: ${r.windDirection}&deg;</p>
              <p>Humidity: ${r.humidity}%</p>
              <p>Clouds: ${r.clouds}%</p>`;
              }
            });
          }
        }
        // If it's the dashboard link
        else if (e.target.classList.contains('marker__link')) {
          e.preventDefault();
          const link = e.target;
          const url = link.attributes.url.nodeValue;

          // Navigation if possible
          if (this.componentInstance && this.componentInstance.$router) {
            this.componentInstance.$router.push(url);
          } else {
            // Fallback to normal navigation
            window.location.href = link.href;
          }
        }
      });
    });

    // Mark that we've configured events
    marker._hasPopupEvents = true;
  }
};
export default markerRenderer;