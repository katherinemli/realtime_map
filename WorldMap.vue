<template>
  <div class="mapclass">
    <div class="map__wrapper">
      <!-- Icons for markers (hidden) -->
      <div class="map__icons" style="display: none;">
        <div v-for="(item, index) in $const('TREE_ICONS')" :key="index">
          <font-awesome-icon v-if="item !== 'none'" :icon="item" :id="'icon_' + index" width="24px"
            height="24px"></font-awesome-icon>
        </div>
        <div class="map__icon">
          <font-awesome-icon :icon="'satellite'" :id="'icon_16'" width="20px" height="20px"></font-awesome-icon>
        </div>
      </div>

      <!-- Error message if exists -->
      <div v-if="mapCoordinator.errorInfo.code !== 0" class="map__error">
        [{{ mapCoordinator.errorInfo.code }}] {{ mapCoordinator.errorInfo.message }}
      </div>

      <!-- Leaflet Map Component -->
      <l-map class="map__map" ref="nmsMap" :zoom="zoom" :minZoom="minZoom" :maxZoom="maxZoom" :preferCanvas="true"
        @update:zoom="handleZoomChange" @update:bounds="handleBoundsChange" @update:center="handleCenterChange">

        <!-- Map Control Component -->
        <map-control :modes-config="modemap" :marker-mode="mapCoordinator.currentMarkerMode"
          :enabled-titles="enabledTitles" :api-key-error="mapCoordinator.errorInfo.code !== 0" :beams="beams"
          :titles="titles" :sats="sats" :weather-type-value="weatherType" @update:marker-mode="handleMarkerModeChange"
          @update:beams="handleBeamsChange" @update:titles="handleTitlesChange" @update:sats="handleSatsChange"
          @update:weather-type="handleWeatherTypeChange" @toggle-tooltips="toggleTooltips" @redraw-canvas="redrawCanvas"
          @close-tooltips="closeTooltips" />

        <!-- Base map layer -->
        <l-tile-layer :url="url" :attribution="attribution"></l-tile-layer>

        <!-- Weather layer -->
        <weather-layer :type="weatherType" :visible="showWeatherTile" :api-key="weatherApiKey" />

        <!-- Marker legend (visible when not in num_state) -->
        <marker-legend :visible="mapCoordinator.currentMarkerMode !== 'num_state'"
          :marker-mode-name="mapCoordinator.markerModeName" :marker-refs="markerRefs" />

        <!-- Marker group -->
        <l-feature-group ref="markerGroup"></l-feature-group>
      </l-map>
    </div>
  </div>
</template>

<script>
// External dependency imports
import L from 'leaflet';
import { LMap, LTileLayer, LControl, LFeatureGroup } from 'vue2-leaflet';
import { Icon } from 'leaflet';
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Mixin imports
import dataTracker from '@/components/mixins/datatracker.js';

// Custom module imports
import mapCoordinator from './modules/mapCoordinator.js';
import markerManager from './modules/markerManager.js';
import markerRenderer from './modules/markerRenderer.js';
import userInteractionManager from './modules/userInteractionManager.js';
import realtimeManager from './modules/realtimeManager.js';
import iconSizeUtils from './utilsMap/iconSizeUtils.js';
import MapControl from './modules/controls/MapControl.vue';
import WeatherLayer from './modules/layers/WeatherLayer.vue';
import MarkerLegend from './modules/controls/MarkerLegend.vue';

// Default Leaflet icon configuration
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export default {
  name: 'WorldMapComponent',
  mixins: [dataTracker],
  props: {
    someValueToPass: Boolean
  },
  components: {
    LMap,
    LTileLayer,
    LControl,
    LFeatureGroup,
    MapControl,
    WeatherLayer,
    MarkerLegend
  },
  data() {
    return {
      beams: false,
      titles: false,
      sats: false,
      weatherType: 'noweather',
      enabledTitles: true,
      // Map state - Initialized from mapCoordinator module
      mapCoordinator: mapCoordinator.createCoordinator(),

      // Map configuration
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      zoom: 5,
      minZoom: 3,
      maxZoom: 15,
      // Display options
      showWeatherTile: false,

      // Weather configuration
      weatherApiKey: '',
      // Data state
      dataIsLoaded: false,
      // Visual state
      currentTooltipState: false,
      // Icon sizes
      iconSizes: null,
      dataP: {},
      // Marker mode configuration
      modemap: {
        mode: [
          { name: "state", value: "num_state", max: 9, units: "" , selected: true},
          { name: "hubCn", value: "cn_on_hub", max: 25, units: "dB" , selected: false},
          { name: "hubCnScaled", value: "sc_hub_cn", max: 100, units: "%" , selected: false},
          { name: "stationCn", value: "station_cn", max: 25, units: "dB" , selected: false},
          { name: "stationCnScaled", value: "sc_stn_cn", max: 100, units: "%" , selected: false},
          { name: "forwardAcm", value: "forward_acm", max: 8, units: "" , selected: false},
          { name: "returnAcm", value: "return_acm", max: 16, units: "" , selected: false}
        ]
      },
      // Marker legend configuration
      markerRefs: [],
    };
  },
  watch: {
    someValueToPass(value, oldValue) {
      if (this.dataIsLoaded) {
        this.dataP = this.backendReply.reply;

        if (this.mapCoordinator.isReady) {
          // Now use event system to handle updates
          this.queueEvent('data_update', { data: this.dataP });
        }
      }
    }
  },
  methods: {
    // ==== Initialization Methods ====
    async initializeMap() {
      if (this.mapCoordinator.debug) {
        ////console.log('[WorldMapComponent] Initializing map component');
      }

      try {
        // Get map object
        const map = this.$refs.nmsMap.mapObject;
        if (map.zoomControl) {
          map.zoomControl.remove();
        }
        L.control.zoom({
          position: 'bottomright'
        }).addTo(map);
        // Initialize icon sizes based on initial zoom
        this.iconSizes = iconSizeUtils.calculateIconSizes(this.zoom);
        this.mapCoordinator.iconSizes = this.iconSizes;
        this.mapCoordinator.currentZoom = this.zoom;
        // Initialize coordinators and managers
        await this.initializeCoordinators(map);

        // Initialize map with data
        await this.initMapWithData();

        // Mark as ready
        this.mapCoordinator.isReady = true;
        this.mapCoordinator.state = 'ready';

        if (this.mapCoordinator.debug) {
          ////console.log('[WorldMapComponent] Map initialized successfully');
        }
      } catch (error) {
        console.error('[WorldMapComponent] Error initializing map:', error);
        this.mapCoordinator.errorInfo.code = 500;
        this.mapCoordinator.errorInfo.message = 'Error initializing map: ' + error.message;
        this.mapCoordinator.state = 'error';
      }
    },

    async initializeCoordinators(map) {
      // Initialize coordinators with necessary references
      markerManager.initialize(this.mapCoordinator, map, this.$refs.markerGroup.mapObject);

      // Pass Vue component instance to markerRenderer to access $const
      markerRenderer.initialize(this.mapCoordinator, map, this);

      userInteractionManager.initialize(this.mapCoordinator, map);
      realtimeManager.initialize(this.mapCoordinator, map);

      // Register map events
      mapCoordinator.registerEvents(this);
    },

    async initMapWithData() {
      if (!this.dataP) {
        console.warn('[WorldMapComponent] No data available to initialize map');
        return;
      }

      const map = this.$refs.nmsMap.mapObject;

      // Configure map based on received data
      if (this.dataP.map_url) {
        this.url = this.dataP.map_url === 'local'
          ? this.$const('CORE_STATIC') + '/map_tiles/{z}/{x}/{y}{r}.jpg'
          : this.dataP.map_url;
      }

      // Configure initial view
      if (this.dataP.lat && this.dataP.lon) {
        map.setView([this.dataP.lat, this.dataP.lon], this.dataP.scale || this.zoom);
        // Update zoom in coordinator
        this.mapCoordinator.currentZoom = map.getZoom();
        this.iconSizes = iconSizeUtils.calculateIconSizes(this.mapCoordinator.currentZoom);
        this.mapCoordinator.iconSizes = this.iconSizes;
      }

      // Process markers if they exist
      if (this.dataP.list && Array.isArray(this.dataP.list)) {
        await this.queueEvent('process_markers', { markers: this.dataP.list });
      }
    },

    // ==== Event Methods ====

    // Queues an event in the coordinator
    queueEvent(eventType, eventData, priority = 'normal') {
      mapCoordinator.queueEvent(this.mapCoordinator, eventType, eventData, priority);
    },

    // ==== Map Event Handlers ====

    handleZoomChange(zoom) {
      this.queueEvent('user_zoom_change', { zoom }, 'high');
    },

    handleBoundsChange(bounds) {
      this.queueEvent('user_bounds_change', { bounds }, 'high');
    },

    handleCenterChange(center) {
      this.queueEvent('user_center_change', { center }, 'normal');
    },
    // ==== Tooltip Methods ====
    toggleTooltips(state) {
      // Change tooltip state and notify managers
      const newState = state !== undefined ? state : !this.currentTooltipState;
      this.currentTooltipState = newState;
      this.mapCoordinator.currentTooltipState = newState;

      // Notify change to apply
      this.queueEvent('update_tooltip_state', { enabled: newState }, 'normal');
    },
    // Method to redraw canvas (used when sats change)
    redrawCanvas() {
      if (this.mapCoordinator.debug) {
        ////console.log('[WorldMapComponent] Redrawing canvas');
      }

      // Update icons and redraw markers
      const iconSizes = iconSizeUtils.calculateIconSizes(this.mapCoordinator.currentZoom);
      this.mapCoordinator.iconSizes = iconSizes;

      // Queue event to update icon sizes
      this.queueEvent('update_icon_sizes', { iconSizes }, 'normal');
    },
    // Method to request weather data for a specific point
    async requestWeatherInPoint(lat, lon, isInit = false) {
      if (!this.weatherApiKey) {
        if (isInit) {
          console.warn('[WorldMapComponent] Weather API key not specified');
          this.mapCoordinator.errorInfo.code = 401;
          this.mapCoordinator.errorInfo.message = 'OpenWeatherMap API key not specified';
        }
        return null;
      }

      try {
        const mapServer = this.mapCoordinator.weatherServer || 'api';
        const response = await fetch(
          `https://${mapServer}.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.weatherApiKey}&metric`
        );

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        return {
          hasWeather: true,
          clouds: data.clouds.all,
          temperature: data.main.temp,
          pressure: data.main.pressure,
          humidity: data.main.humidity,
          weather: data.weather[0].description,
          windSpeed: data.wind.speed,
          windDirection: data.wind.deg
        };
      } catch (error) {
        console.error('[WorldMapComponent] Error getting weather data:', error);

        if (isInit) {
          console.warn('[WorldMapComponent] Weather API key incorrect or request limit exceeded');
          this.mapCoordinator.errorInfo.code = 401;
          this.mapCoordinator.errorInfo.message = 'OpenWeatherMap API key incorrect or request limit exceeded';
        }

        return null;
      }
    },
    // Handles marker mode change
    handleMarkerModeChange(modeInfo) {
      // Check if a mode change is already in progress
      if (this.isModeChanging) {
        console.warn('[WorldMapComponent] Mode change in progress, ignoring new request');
        return; // Ignore clicks while processing
      }

      // Mark that we are in mode change process
      this.isModeChanging = true;

      if (this.mapCoordinator.debug) {
        ////console.log(`[WorldMapComponent] Marker mode change: ${modeInfo.mode}`);
      }

      // Add a temporary class during transition
      if (this.$refs.nmsMap && this.$refs.nmsMap.mapObject) {
        this.$refs.nmsMap.mapObject.getContainer().classList.add('marker-mode-changing');
      }

      // Stop real-time updates during change
      import('./modules/realtimeManager.js').then(module => {
        module.default.stopUpdates();
      });

      // Close all open popups
      if (this.$refs.nmsMap && this.$refs.nmsMap.mapObject) {
        this.$refs.nmsMap.mapObject.closePopup();
      }
      ////console.log(`%c 2.handleMarkerModeChange=> M:${modeInfo.mode} N: ${modeInfo.name}`, 'background: blue; color: #bada55');

      // Update values in coordinator
      this.mapCoordinator.currentMarkerMode = modeInfo.mode;
      this.mapCoordinator.markerModeName = modeInfo.name;
      this.mapCoordinator.markerModeMax = modeInfo.max;
      this.mapCoordinator.markerModeUnits = modeInfo.units;

      // Create visual overlay to block interactions during processing
      const mapContainer = this.$refs.nmsMap.mapObject.getContainer();
      const blockOverlay = document.createElement('div');
      blockOverlay.className = 'map-mode-change-overlay';

      // Explicitly clear icon cache
      import('./modules/markerRenderer.js').then(module => {
        if (typeof module.default.clearIconCache === 'function') {
          try {
            module.default.clearIconCache(true); // Use true to force complete cleanup
            ////console.log('[WorldMapComponent] Icon cache cleared successfully');
          } catch (error) {
            console.error('[WorldMapComponent] Error clearing icon cache:', error);
          }
        }
      });

      // Specific configuration by mode
      if (modeInfo.mode === 'num_state') {
        // For state mode - Configure to use discrete colors
        if (!this.mapCoordinator.stateColors && this.$const && this.$const('nms_states_white_numeric')) {
          this.mapCoordinator.stateColors = this.$const('nms_states_white_numeric');
        }
        // Do not show legend for this mode
        this.markerRefs = [];
      } else {
        // For other modes - Update legend with appropriate values
        this.updateMarkerLegend(modeInfo.mode);
      }

      // Clear any pending marker-related events
      this.mapCoordinator.eventQueue = this.mapCoordinator.eventQueue.filter(
        e => !e.type.includes('marker') && !e.type.includes('update')
      );

      // Queue event to update markers with maximum priority
      this.queueEvent('update_marker_mode', {
        mode: modeInfo.mode,
        name: modeInfo.name,
        max: modeInfo.max,
        units: modeInfo.units,
        initiatedByUser: true
      }, 'critical');

      // Remove transition class and unblock interface after a time
      setTimeout(() => {
        if (this.$refs.nmsMap && this.$refs.nmsMap.mapObject) {
          const mapContainer = this.$refs.nmsMap.mapObject.getContainer();
          mapContainer.classList.remove('marker-mode-changing');

          // Remove blocking overlay
          const overlay = mapContainer.querySelector('.map-mode-change-overlay');
          if (overlay) {
            overlay.remove();
          }
        }

        // Restart real-time updates
        import('./modules/realtimeManager.js').then(module => {
          module.default.startUpdates();
        });

        // Mark that change has completed
        this.isModeChanging = false;

        ////console.log('[WorldMapComponent] Mode change completed');
      }, 100); // Give enough time for transition
    },
    // Updates marker legend based on mode
    updateMarkerLegend(mode) {
      // Can customize reference values for each mode
      const markerRefs = {
        'cn_on_hub': ['0dB', '6.25dB', '12.5dB', '18.75dB', '25dB'],
        'station_cn': ['0dB', '6.25dB', '12.5dB', '18.75dB', '25dB'],
        'sc_hub_cn': ['0%', '25%', '50%', '75%', '100%'],
        'sc_stn_cn': ['0%', '25%', '50%', '75%', '100%'],
        'forward_acm': ['0', '2', '4', '6', '8'],
        'return_acm': ['0', '4', '8', '12', '16']
      };

      this.markerRefs = markerRefs[mode] || [];
    },
    // Handles beams display change
    handleBeamsChange(value) {
      this.beams = value;

      // If there's a specific action for beams, do it here
      if (this.mapCoordinator.debug) {
        ////console.log(`[WorldMapComponent] Beams change: ${value}`);
      }
    },

    // Handles titles display change
    handleTitlesChange(value) {
      this.titles = value;
      this.mapCoordinator.currentTooltipState = value;
      if (this.mapCoordinator.debug) {
        ////console.log(`[WorldMapComponent] Titles change: ${value}`);
      }
      // Tooltip update is handled in toggleTooltips() called from the component
    },

    // Handles satellites display change
    handleSatsChange(value) {
      this.sats = value;

      // Canvas update is handled in redrawCanvas() called from the component
    },

    // Handles weather type change
    handleWeatherTypeChange(value) {
      this.weatherType = value;

      if (this.mapCoordinator.debug) {
        ////console.log(`[WorldMapComponent] Weather type change: ${value}`);
      }

      // Update weather layer visibility
      this.showWeatherTile = value !== 'noweather';

      // Check for API key error
      if (value !== 'noweather' && !this.weatherApiKey) {
        console.warn('[WorldMapComponent] Weather API key not specified or incorrect');
        this.mapCoordinator.errorInfo.code = 401;
        this.mapCoordinator.errorInfo.message = 'OpenWeatherMap API key not specified or incorrect';
      }
    },
    // Method to close all tooltips
    closeTooltips() {
      if (this.mapCoordinator.debug) {
        ////console.log('[WorldMapComponent] Closing all tooltips');
      }

      // Queue event to close tooltips
      this.queueEvent('update_tooltip_state', { enabled: false }, 'normal');
    },

    // Method to toggle tooltip visibility
    toggleTooltips() {
      // Use current titles value that was already updated by child component
      const newState = this.titles;

      // Update state in coordinator
      this.mapCoordinator.currentTooltipState = newState;

      if (this.mapCoordinator.debug) {
        ////console.log(`[WorldMapComponent] Toggling tooltips: ${newState}`);
      }

      // Queue event to update tooltip state
      this.queueEvent('update_tooltip_state', { enabled: newState }, 'normal');
    },
    // Method to configure weather layer URL
    configureWeatherLayer(type) {
      const apiKey = this.mapCoordinator.weatherApiKey || '';

      // Weather layer URLs
      const weatherUrls = {
        'precip': `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        'pressure': `https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        'wind': `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        'temp': `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`,
        'clouds': `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`
      };

      // Update weather layer URL
      if (weatherUrls[type]) {
        this.weatherLayerUrl = weatherUrls[type];
      }
    }
  },
  async mounted() {
    // Load data
    await this.dataTracker();
    this.dataIsLoaded = true;
    this.dataP = this.backendReply.reply;

    // Initialize map when data is available
    this.$nextTick(() => {
      this.initializeMap();
    });
  },
  beforeDestroy() {
    if (this.mapCoordinator.debug) {
      ////console.log('[WorldMapComponent] Cleaning up map component...');
    }

    // Stop real-time updates
    realtimeManager.stopUpdates();

    // Clear markers
    markerManager.clearAllMarkers();

    // Clear events
    mapCoordinator.unregisterEvents(this);

    // Clean up map
    if (this.$refs.nmsMap && this.$refs.nmsMap.mapObject) {
      const map = this.$refs.nmsMap.mapObject;
      map.off();
    }
  }
};
</script>