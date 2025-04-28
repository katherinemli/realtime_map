/**
 * iconFactory.js
 * Factory for creating and manipulating marker icons
 */

import L from 'leaflet';

const iconFactory = {
  // Cache for icons (improves performance)
  iconCache: new Map(),
  
  /**
   * Clears the icon cache
   */
  clearCache() {
    this.iconCache.clear();
  },
  
  /**
   * Converts an SVG to string with custom color
   * @param {String} fillColor - Fill color
   * @param {Element} iconElement - SVG element to convert
   * @returns {String} Modified SVG string
   */
  convertSvgToString(fillColor, iconElement) {
    if (!iconElement) {
      return null;
    }
    
    // Clone the original SVG element
    const svgClone = iconElement.cloneNode(true);
    
    // Modify the path to change color
    const pathElement = svgClone.querySelector('path');
    if (pathElement) {
      pathElement.setAttribute('fill', fillColor);
    }
    
    // Convert cloned SVG to string
    return new XMLSerializer().serializeToString(svgClone);
  },
  
  /**
   * Creates a marker icon from an SVG
   * @param {String} svgString - SVG string
   * @param {Object} options - Icon options
   * @returns {Object} Leaflet icon
   */
  createSvgIcon(svgString, options = {}) {
    // Default options
    const iconOptions = {
      iconSize: options.iconSize || [20, 20],
      iconAnchor: options.iconAnchor || [10, 10],
      popupAnchor: options.popupAnchor || [0, -10],
      className: options.className || 'custom-marker'
    };
    
    // Create divIcon with SVG
    return L.divIcon({
      html: svgString,
      ...iconOptions
    });
  },
  
  /**
   * Creates a numeric icon
   * @param {Number} number - Number to display
   * @param {String} fillColor - Background color
   * @param {Object} options - Additional options
   * @returns {Object} Leaflet icon
   */
  createNumericIcon(number, fillColor, options = {}) {
    // Cache key
    const cacheKey = `num_${number}_${fillColor}`;
    
    // Check if already in cache
    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey);
    }
    
    // Ensure positive integer
    const displayNum = Math.abs(Math.floor(number)) % 100;
    
    // Options
    const size = options.size || 24;
    const borderWidth = options.borderWidth || 2;
    const textColor = options.textColor || 'white';
    const fontSize = options.fontSize || 10;
    
    // Create SVG with text
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${(size/2) - borderWidth}" fill="${fillColor}" stroke="white" stroke-width="${borderWidth}"/>
        <text x="${size/2}" y="${size/2}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-weight="bold">
          ${displayNum}
        </text>
      </svg>
    `;
    
    // Create icon
    const icon = L.divIcon({
      className: 'numeric-marker',
      html: svgIcon,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2]
    });
    
    // Save in cache
    this.iconCache.set(cacheKey, icon);
    
    return icon;
  },
  
  /**
   * Creates a default circular icon
   * @param {String} fillColor - Fill color
   * @param {Object} options - Additional options
   * @returns {Object} Leaflet icon
   */
  createCircleIcon(fillColor, options = {}) {
    // Cache key
    const cacheKey = `circle_${fillColor}`;
    
    // Check if already in cache
    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey);
    }
    
    // Options
    const size = options.size || 20;
    const borderWidth = options.borderWidth || 2;
    const borderColor = options.borderColor || 'white';
    
    // Create simple SVG
    const svgIcon = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${(size/2) - borderWidth}" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>
      </svg>
    `;
    
    // Create icon
    const icon = L.divIcon({
      className: 'default-marker',
      html: svgIcon,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2]
    });
    
    // Save in cache
    this.iconCache.set(cacheKey, icon);
    
    return icon;
  },
  
  /**
   * Creates a custom icon
   * @param {String} type - Icon type ('numeric', 'circle', 'svg')
   * @param {Object} options - Icon options
   * @returns {Object} Leaflet icon
   */
  createIcon(type, options = {}) {
    switch(type) {
      case 'numeric':
        return this.createNumericIcon(
          options.number || 0,
          options.color || '#ff5733',
          options
        );
        
      case 'circle':
        return this.createCircleIcon(
          options.color || '#ff5733',
          options
        );
        
      case 'svg':
        if (!options.svgString && options.element) {
          options.svgString = this.convertSvgToString(
            options.color || '#ff5733',
            options.element
          );
        }
        
        if (options.svgString) {
          return this.createSvgIcon(options.svgString, options);
        }
        
        // Fallback to circle if no SVG
        return this.createCircleIcon(options.color || '#ff5733', options);
        
      default:
        // Unknown type, use default circle
        return this.createCircleIcon(options.color || '#ff5733', options);
    }
  },
  
  /**
   * Creates a clustered marker icon
   * @param {Number} count - Number of markers in cluster
   * @param {String} baseColor - Base cluster color
   * @returns {Object} Leaflet icon
   */
  createClusterIcon(count, baseColor = '#ff5733') {
    // Determine size based on marker count
    let size = 30;
    if (count > 100) {
      size = 60;
    } else if (count > 50) {
      size = 50;
    } else if (count > 10) {
      size = 40;
    }
    
    // Adjust color based on count
    let color = baseColor;
    if (count > 100) {
      color = '#ff0000'; // Red for large clusters
    } else if (count > 50) {
      color = '#ff5733'; // Orange for medium clusters
    } else if (count > 10) {
      color = '#ffc300'; // Yellow for small clusters
    }
    
    // Create cluster SVG
    const svgIcon = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${(size/2) - 2}" fill="${color}" fill-opacity="0.7" stroke="white" stroke-width="2"/>
        <text x="${size/2}" y="${size/2}" font-size="${size/3}" text-anchor="middle" dominant-baseline="central" fill="white" font-weight="bold">
          ${count}
        </text>
      </svg>
    `;
    
    // Create icon
    return L.divIcon({
      className: 'cluster-marker',
      html: svgIcon,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  }
};

export default iconFactory;