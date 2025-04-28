<!-- 
  WeatherLayer.vue
  Modular component for weather layer on the map
-->

<template>
  <div>
    <!-- Weather layer -->
    <l-tile-layer v-if="visible" :url="url" :opacity="0.7" :zIndex="10"></l-tile-layer>

    <!-- Weather legend (visible only when layer is active) -->
    <l-control v-if="visible" class="leaflet-control-weather" position="bottomleft">
      <div :class="'weather__legend--' + type" class="weather__legend">
        <div class="weather__title">{{ type }}</div>
        <div class="weather__lines">
          <div class="weather__refs">
            <span v-for="(ref, index) in references" :key="index" class="weather__ref">{{ ref }}</span>
          </div>
          <div :class="'weather__gradient--' + type" class="weather__gradient"></div>
        </div>
      </div>
    </l-control>
  </div>
</template>

<script>
import { LTileLayer, LControl } from 'vue2-leaflet';

export default {
  name: 'WeatherLayer',
  components: {
    LTileLayer,
    LControl
  },
  props: {
    // Weather type (precip, pressure, wind, temp, clouds, etc.)
    type: {
      type: String,
      default: 'noweather'
    },
    // If layer should be visible
    visible: {
      type: Boolean,
      default: false
    },
    // API key for OpenWeatherMap
    apiKey: {
      type: String,
      default: ''
    }
  },
  computed: {
    // URL of the weather layer
    url() {
      if (this.type === 'noweather' || !this.apiKey) {
        return '';
      }

      const baseUrl = 'https://tile.openweathermap.org/map/';
      const urls = {
        'precip': `${baseUrl}precipitation_new/{z}/{x}/{y}.png?appid=${this.apiKey}`,
        'pressure': `${baseUrl}pressure_new/{z}/{x}/{y}.png?appid=${this.apiKey}`,
        'wind': `${baseUrl}wind_new/{z}/{x}/{y}.png?appid=${this.apiKey}`,
        'temp': `${baseUrl}temp_new/{z}/{x}/{y}.png?appid=${this.apiKey}`,
        'clouds': `${baseUrl}clouds_new/{z}/{x}/{y}.png?appid=${this.apiKey}`
      };

      return urls[this.type] || '';
    },

    // Legend references based on weather type
    references() {
      const refs = {
        'precip': ['0mm', '50mm', '100mm', '150mm', '200mm'],
        'pressure': ['942.92hPa', '1013.25hPa', '1070.64hPa'],
        'wind': ['0m/s', '7m/s', '13m/s', '20m/s', '27m/s'],
        'temp': ['-40°C', '-20°C', '0°C', '20°C', '40°C'],
        'clouds': ['0%', '25%', '50%', '75%', '100%']
      };

      return refs[this.type] || [];
    }
  }
};
</script>

<style scoped>
.weather__legend {
  background-color: rgba(255, 255, 255, 0.8);
  padding: 8px;
  border-radius: 4px;
  min-width: 180px;
}

.weather__title {
  font-weight: bold;
  margin-bottom: 5px;
  text-transform: capitalize;
}

.weather__lines {
  display: flex;
  flex-direction: column;
}

.weather__refs {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
  font-size: 0.8em;
}

.weather__gradient {
  height: 10px;
  border-radius: 2px;
}

/* Gradients for different weather types */
.weather__gradient--precip {
  background: linear-gradient(to right, transparent, #9be6ff, #00b4f0, #0073bf, #00214e);
}

.weather__gradient--pressure {
  background: linear-gradient(to right, #0000cd, #0046ff, #48cae4, #ade8f4, #caf0f8);
}

.weather__gradient--wind {
  background: linear-gradient(to right, #e6ecf0, #a3c0d0, #82a9c3, #5584b1, #1e5b9b);
}

.weather__gradient--temp {
  background: linear-gradient(to right, #053061, #2166ac, #f7f7f7, #b2182b, #67001f);
}

.weather__gradient--clouds {
  background: linear-gradient(to right, transparent, #f8f9fa, #dee2e6, #adb5bd, #495057);
}
</style>