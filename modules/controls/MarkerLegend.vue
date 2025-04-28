<!-- 
  MarkerLegend.vue
  Component for displaying marker mode legend
-->

<template>
  <l-control v-if="visible" class="leaflet-control-marker-legend" position="bottomleft">
    <div class="marker__legend">
      <div class="marker__title">{{ markerModeName }}</div>
      <div class="marker__lines">
        <div class="marker__refs">
          <span v-for="(ref, index) in markerRefs" :key="index" class="marker__ref">{{ ref }}</span>
        </div>
        <div class="marker__gradient"></div>
      </div>
    </div>
  </l-control>
</template>

<script>
import { LControl } from 'vue2-leaflet';

export default {
  name: 'MarkerLegend',
  components: {
    LControl
  },
  props: {
    // If legend should be visible
    visible: {
      type: Boolean,
      default: false
    },
    // Marker mode name
    markerModeName: {
      type: String,
      default: ''
    },
    // References for the legend
    markerRefs: {
      type: Array,
      default: () => []
    }
  }
};
</script>

<style scoped>
.marker__legend {
  background-color: rgba(255, 255, 255, 0.8);
  padding: 8px;
  border-radius: 4px;
  min-width: 180px;
  margin-top: 8px;
}

.marker__title {
  font-weight: bold;
  margin-bottom: 5px;
  text-transform: capitalize;
}

.marker__lines {
  display: flex;
  flex-direction: column;
}

.marker__refs {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
  font-size: 0.8em;
}

.marker__gradient {
  height: 10px;
  border-radius: 2px;
  background: linear-gradient(to right, #d00000, #ffaa00, #00d000);
}
</style>