/**
 * iconSizeUtils.js
 * Utilities for handling icon sizes according to zoom level
 * 
 * This module centralizes the logic for:
 * 1. Calculating icon sizes based on zoom
 * 2. Providing a consistent size interface
 * 3. Determining when icon updates are necessary
 */

const iconSizeUtils = {
  /**
   * Calculates icon sizes based on zoom level
   * @param {Number} zoomLevel - Current zoom level
   * @returns {Object} Object with size configurations for normal and satellite icons
   */
  calculateIconSizes(zoomLevel) {
    let iconSize, satIconSize;

    // Clearly different sizes for each zoom level
    if (zoomLevel >= 13) {
      // Very close zoom - smaller icons
      iconSize = [16, 16];
      satIconSize = [14, 14];
    } else if (zoomLevel >= 10) {
      // Close zoom
      iconSize = [24, 24];
      satIconSize = [20, 20];
    } else if (zoomLevel >= 7) {
      // Medium zoom
      iconSize = [32, 32];
      satIconSize = [26, 26];
    } else if (zoomLevel >= 5) {
      // Distant zoom
      iconSize = [40, 40];
      satIconSize = [32, 32];
    } else {
      // Very distant zoom - larger icons
      iconSize = [48, 48];
      satIconSize = [40, 40];
    }

    return {
      icon: {
        size: iconSize,
        anchor: [iconSize[0] / 2, iconSize[1] / 2],
        popupAnchor: [0, -iconSize[1] / 2]
      },
      satellite: {
        size: satIconSize,
        anchor: [satIconSize[0] / 2, satIconSize[1] / 2],
        popupAnchor: [0, -satIconSize[1] / 2]
      }
    };
  },

  /**
   * Checks if icon sizes have changed
   * @param {Object} currentSizes - Current sizes
   * @param {Object} newSizes - Newly calculated sizes
   * @returns {Boolean} True if sizes have changed
   */
  haveSizesChanged(currentSizes, newSizes) {
    if (!currentSizes || !newSizes) return true;

    return JSON.stringify(currentSizes.icon.size) !== JSON.stringify(newSizes.icon.size) ||
      JSON.stringify(currentSizes.satellite.size) !== JSON.stringify(newSizes.satellite.size);
  }
};

export default iconSizeUtils;