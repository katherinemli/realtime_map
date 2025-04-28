<!-- 
  MapControl.vue
  Modular component for map control options
-->

<template>
  <div>
    <!-- Layer and marker mode control -->
    <l-control class="map__layers" position="topright">
      <font-awesome-icon :icon="'layer-group'" class="map__hoverlayers"></font-awesome-icon>
      <div class="map__prefs">
        <!-- Marker mode column -->
        <div class="pref__column">
          <div class="pref__title">{{ $t('map.markerMode') }}:</div>
          <div class="pref__list">
            <label v-for="(item, index) in modesConfig.mode" :key="item.value" class="ts__label">
              <input 
                @change="updateMarkerMode(item)"
                v-model="currentMarkerMode" 
                :value="item.value"
                type="radio" 
                name="markerMode" 
                class="ts__checkbox"
              >
              <span class="ts__span"></span>
              <div class="ts__title">{{ $t(`map.${item.name}`) }}</div>
            </label>
          </div>
        </div>

        <!-- Display and weather options column -->
        <div class="pref__column">
          <!-- Display options -->
          <div class="pref__box">
            <div class="pref__title">{{ $t('map.display') }}:</div>
            <div class="pref__list">
              <label class="ts__label">
                <input v-model="displayOptions.beams" type="checkbox" class="ts__checkbox" @change="emitDisplayChange('beams')">
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.beams') }}</div>
              </label>
              <label :class="{ 'ts__label--disabled': !enabledTitles }" class="ts__label">
                <input 
                  v-model="displayOptions.titles" 
                  type="checkbox" 
                  class="ts__checkbox" 
                  @change="toggleTitles"
                >
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.titles') }}</div>
              </label>
              <label :class="{ 'ts__label--disabled': !enabledTitles }" class="ts__label">
                <input v-model="displayOptions.sats" type="checkbox" class="ts__checkbox" @change="emitDisplayChange('sats')">
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.sats') }}</div>
              </label>
              <button class="test" @click="closeAllTooltips">Close</button>
            </div>
          </div>

          <!-- Weather options -->
          <div class="pref__box">
            <div class="pref__title">{{ $t('map.weather') }}:</div>
            <div class="pref__list">
              <div v-if="apiKeyError" class="pref__err">
                ApiKey is not specified or incorrect
              </div>
              <label :class="{ 'ts__label--disabled': apiKeyError }" class="ts__label">
                <input v-model="weatherType" value="noweather" type="radio" name="weatherType" class="ts__checkbox" @change="emitWeatherChange">
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.noWeather') }}</div>
              </label>
              <label :class="{ 'ts__label--disabled': apiKeyError }" class="ts__label">
                <input v-model="weatherType" value="precip" type="radio" name="weatherType" class="ts__checkbox" @change="emitWeatherChange">
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.precipitation') }}</div>
              </label>
              <label :class="{ 'ts__label--disabled': apiKeyError }" class="ts__label">
                <input v-model="weatherType" value="pressure" type="radio" name="weatherType" class="ts__checkbox" @change="emitWeatherChange">
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.pressure') }}</div>
              </label>
              <label :class="{ 'ts__label--disabled': apiKeyError }" class="ts__label">
                <input v-model="weatherType" value="temp" type="radio" name="weatherType" class="ts__checkbox" @change="emitWeatherChange">
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.temperature') }}</div>
              </label>
              <label :class="{ 'ts__label--disabled': apiKeyError }" class="ts__label">
                <input v-model="weatherType" value="wind" type="radio" name="weatherType" class="ts__checkbox" @change="emitWeatherChange">
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.windSpeed') }}</div>
              </label>
              <label :class="{ 'ts__label--disabled': apiKeyError }" class="ts__label">
                <input v-model="weatherType" value="clouds" type="radio" name="weatherType" class="ts__checkbox" @change="emitWeatherChange">
                <span class="ts__span"></span>
                <div class="ts__title">{{ $t('map.clouds') }}</div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </l-control>
  </div>
</template>

<script>
import { LControl } from 'vue2-leaflet';

export default {
  name: 'MapControl',
  components: {
    LControl
  },
  props: {
    // Marker mode configuration based on markermode.json
    modesConfig: {
      type: Object,
      default: () => ({ 
        mode: [
          { name: "state", value: "num_state", max: 9, units: "" },
          { name: "hubCn", value: "cn_on_hub", max: 25, units: "dB" },
          { name: "hubCnScaled", value: "sc_hub_cn", max: 100, units: "%" },
          { name: "stationCn", value: "station_cn", max: 25, units: "dB" },
          { name: "stationCnScaled", value: "sc_stn_cn", max: 100, units: "%" },
          { name: "forwardAcm", value: "forward_acm", max: 8, units: "" },
          { name: "returnAcm", value: "return_acm", max: 16, units: "" }
        ] 
      })
    },
    // Current marker mode
    markerMode: {
      type: String,
      default: 'num_state'
    },
    // If titles are enabled
    enabledTitles: {
      type: Boolean,
      default: true
    },
    // If there's an API key error
    apiKeyError: {
      type: Boolean,
      default: false
    },
    // Initial value for beams
    beams: {
      type: Boolean,
      default: false
    },
    // Initial value for titles
    titles: {
      type: Boolean,
      default: false
    },
    // Initial value for satellites
    sats: {
      type: Boolean,
      default: false
    },
    // Initial weather type value
    weatherTypeValue: {
      type: String,
      default: 'noweather'
    }
  },
  data() {
    return {
      currentMarkerMode: 'num_state',
      weatherType: this.weatherTypeValue,
      displayOptions: {
        beams: this.beams,
        titles: this.titles,
        sats: this.sats
      },
      currentModeName: '',
      currentModeMax: 0,
      currentModeUnits: ''
    };
  },
  watch: {
    // Sync props with data when they change
    markerMode(newValue) {
      //console.log('entro aca? markerMode')
      this.currentMarkerMode = newValue;
    },
    weatherTypeValue(newValue) {
      this.weatherType = newValue;
    },
    beams(newValue) {
      this.displayOptions.beams = newValue;
    },
    titles(newValue) {
      this.displayOptions.titles = newValue;
    },
    sats(newValue) {
      this.displayOptions.sats = newValue;
    }
  },
  methods: {
    // Updates marker mode and notifies parent component
    updateMarkerMode(item) {
      //console.log(`%c 1.updateMarkerMode=> clicked: ${item.name} this.currentMarkerMode:${this.currentMarkerMode}`, 'background: blue; color: #bada55');

      this.currentModeName = item.name;
      this.currentModeMax = item.max;
      this.currentModeUnits = item.units;
      
      this.$emit('update:marker-mode', {
        mode: this.currentMarkerMode,
        name: this.currentModeName,
        max: this.currentModeMax,
        units: this.currentModeUnits
      });
    },
    
    // Specific method to handle titles toggle
    toggleTitles() {
      // Emit event with current value, not inverted
      this.$emit('update:titles', this.displayOptions.titles);
      
      // Emit specific event for tooltip toggle
      this.$emit('toggle-tooltips');
    },
    
    // Emits changes in display options (except titles)
    emitDisplayChange(option) {
      this.$emit(`update:${option}`, this.displayOptions[option]);
      
      // Emit specific event for canvas redraw in case of sats
      if (option === 'sats') {
        this.$emit('redraw-canvas');
      }
    },
    
    // Emits changes in weather type
    emitWeatherChange() {
      this.$emit('update:weather-type', this.weatherType);
    },
    
    // Closes all tooltips
    closeAllTooltips() {
      this.$emit('close-tooltips');
    }
  },
  created() {
    // Initialize current mode values from first available mode
    if (this.modesConfig.mode && this.modesConfig.mode.length > 0) {
      const defaultMode = this.modesConfig.mode.find(mode => mode.value === this.currentMarkerMode) 
                         || this.modesConfig.mode[0];
      this.currentModeName = defaultMode.name;
      this.currentModeMax = defaultMode.max;
      this.currentModeUnits = defaultMode.units;
    }
  }
};
</script>