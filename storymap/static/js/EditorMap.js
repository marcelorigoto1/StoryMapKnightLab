// EditorMap.js
//
// Requires: Google Maps, Leaflet, jquery
//

/*
OSMMapType for Google Maps API V3
<https://developers.google.com/maps/documentation/javascript/>
This code shadoes code in KLStoryMap.Map.Leaflet.js -- keep them in sync or unify into a single source file.
*/

function EditorMap(options) {
    this.name = "";
    this.map = null;
    this.markers = [];
    this.markerBounds = this.LatLngBounds();

    this.zoom_listener = null;

    // Default options
    this.options = {
        map_id: options.map_id || 'map',
        map_overlay_id: options.map_overlay_id || 'map_overlay',
        search_id: options.search_id || 'map_search_input',
        handlers: {
            zoom: options.handlers.zoom || function(zoom) {},
            double_click: options.handlers.double_click || function(lat, lng) {},
            marker_drag: options.handlers.marker_drag || function(lat, lng) {},
            search: options.handlers.search || function(lat, lng) {}
        }
    };

    // Shortcut
    this.handlers = this.options.handlers;
}

EditorMap.prototype.onZoom = function() {
    this.handlers.zoom(this.map.getZoom());
}

EditorMap.prototype.getZoom = function() {
    return this.map.getZoom();
}

EditorMap.prototype.setZoom = function(zoom) {
    this.map.setZoom(zoom);
}

EditorMap.prototype.panTo = function(lat, lng) {
    this.map.panTo(this.LatLng(lat, lng));
}

EditorMap.prototype.fitBounds = function(latlngbounds) {
    this.map.fitBounds(latlngbounds);
}


// ------------------------------------------------------------
// Leaflet - legacy from when there was a sibling subclass of EditorMap
// ------------------------------------------------------------

function LeafletEditorMap(options) {
    var self = this;

    EditorMap.apply(this, Array.prototype.slice.call(arguments));

    this.name = "leaflet";
    this.tilelayer = null;

    this.map = L.map(this.options.map_id, {
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        zoomControl: false
    });

    this.map.on('dblclick', function(e) {
        self.handlers.double_click(e.latlng.lat, e.latlng.lng);
    });

    this.zoom_listener = this.onZoom.bind(this);
    this.zoom_control = null;
    this.polyline = null;
}

LeafletEditorMap.prototype = Object.create(EditorMap.prototype);

LeafletEditorMap.prototype.LatLng = function(lat, lng) {
    return L.latLng(lat, lng);
}

LeafletEditorMap.prototype.LatLngBounds = function() {
    return L.latLngBounds([]);
}

LeafletEditorMap.prototype.addPolyLine = function() {
    this.polyline = L.polyline([], {
        color: '#cc0000',
        weight: 2,
        opacity: 1,
        fill: false
    });
    for(var i = 0; i < this.markers.length; i++) {
        this.polyline.addLatLng(this.markers[i].getLatLng());
    }

    this.polyline.addTo(this.map);
}

LeafletEditorMap.prototype.removePolyLine = function() {
    if(this.polyline) {
        this.map.removeLayer(this.polyline);
        this.polyline = null;
    }
}

LeafletEditorMap.prototype.addMarker = function(data, draggable) {
    var latlng = L.latLng(data.location.lat, data.location.lon);

    if (data.location.use_custom_marker) {
      var anchor = data.location.iconSize ? [data.location.iconSize[0] * 0.5, data.location.iconSize[1]] : [24,48] ;
      var icon = L.icon({iconUrl: data.location.icon, iconSize: data.location.iconSize || [48,48], iconAnchor: anchor});
    } else {
      var media = KLStoryMap.MediaType({url: data.media.url});
      if (media.type) {
        var iconClass = "vco-mapmarker-icon vco-icon-" + media.type;
      } else {
        var iconClass = "vco-mapmarker-icon vco-icon-plaintext";
      }

      var icon = L.divIcon({className: 'vco-mapmarker ' + iconClass, iconAnchor:[10, 10]});
    }

    var marker = L.marker(latlng, {
      icon: icon,
      draggable: (draggable || false)
    });
    marker.addTo(this.map);

    if(draggable) {
        marker.on('drag', this.onMarkerDrag.bind(this))
    }

    this.markers.push(marker);
    this.markerBounds.extend(latlng);
    return marker;
}

LeafletEditorMap.prototype.removeMarker = function(i) {
    // Remove marker
    var removed = this.markers.splice(i, 1);
    this.map.removeLayer(removed[0]);

    // Update marker bounds
    this.markerBounds = this.LatLngBounds();
    for(var i = 0; i < this.markers.length; i++) {
        this.markerBounds.extend(this.markers[i].getLatLng());
    }

    // Update polyline
    if(this.polyline) {
        // Doesn't redraw properly when manipulating points via polyline object,
        // even with explicit call to redraw.  So, remove and recreate.
        this.removePolyLine();
        this.addPolyLine();
    }
}


LeafletEditorMap.prototype.clearOverlays = function() {
    this.removePolyLine();

    for(var i = this.markers.length - 1; i >=0; i--) {
        this.map.removeLayer(this.markers[i]);
    }
    this.markers = [];
    this.markerBounds = this.LatLngBounds();
}

LeafletEditorMap.prototype.onMarkerDrag = function() {
    var pos = this.markers[0].getLatLng();
    this.handlers.marker_drag(pos.lat, pos.lng);
}

LeafletEditorMap.prototype.zoomEnable = function(enable) {
    if(enable) {
        if(!this.zoom_control) {
            this.zoom_control = L.control.zoom();
            this.map.addControl(this.zoom_control);
            this.map.on('zoomend', this.zoom_listener);
        }
    } else {
        if(this.zoom_control) {
            this.map.off('zoomend', this.zoom_listener);
            this.map.removeControl(this.zoom_control);
            this.zoom_control = null;
         }
    }
}

// Set center and zoom
LeafletEditorMap.prototype.setView = function(lat, lng, zoom) {
    // Need to use reset option, else map doesn't update properly
    if(zoom) {
        this.map.setView(L.latLng(lat, lng), zoom, {reset: true});
    } else {
        this.map.setView(L.latLng(lat, lng), {reset: true});
    }
}

// Default view (center zoom)
LeafletEditorMap.prototype.setDefaultView = function() {
  if (this.tilelayer.getCenterZoom) {
    var d = this.tilelayer.getCenterZoom(this.map)
    var lat = d.lat ? d.lat : 0;
    var lon = d.lon ? d.lon : 0;
    var zoom = d.zoom ? d.zoom : 1;
    this.map.setView(L.latLng(lat, lon), zoom, {reset: true});
  } else {
    this.setView(0, 0, 1);
  }
}

LeafletEditorMap.prototype.getDefaultView = function() {
  if (this.tilelayer.getCenterZoom) {
    var d = this.tilelayer.getCenterZoom(this.map)
    return {lat: d.lat, lng: d.lon, zoom: d.zoom};
  } else {
    c = this.map.getCenter();
    return {lat: c.lat, lng: c.lng, zoom: this.map.getZoom()}
  }
}


LeafletEditorMap.prototype.setZoomifyMapType = function(map_type, zoomify_data) {
    if(this.tilelayer) {
        this.map.removeLayer(this.tilelayer);
        this.tilelayer = null;
    }

    this.tilelayer.addTo(this.map);
}

LeafletEditorMap.prototype.setMapType = function(storymap_config) {

  if(this.tilelayer) {
      this.map.removeLayer(this.tilelayer);
      this.tilelayer = null;
  }

  var map_type = (storymap_config.storymap.map_type || '');
  if(map_type == "zoomify") {
      zoomify_data = storymap_config.storymap.zoomify;
      this.tilelayer = new KLStoryMap.ZoomifyTileLayer(
          zoomify_data.path,
          zoomify_data
      );
  } else {

    var options = { r: '' };
    if (L.Browser.retina) { options.r = '@2x' }
    if (storymap_config.storymap.map_subdomains) {
        options.subdomains = storymap_config.storymap.map_subdomains;
    }
    if (storymap_config.storymap.attribution) {
        options.attribution = storymap_config.storymap.attribution;
    }

    var parts = map_type.split(':')
    switch(parts[0]) { // this is a little duplicative of stuff in KLStoryMap.Map.Leaflet but I'm not sure that we can use that here. Take a look, though. Otherwise, add new tile layers...
      case 'http':
      case 'https':
        this.tilelayer = L.tileLayer(map_type, options);
        break;
      case 'ch-watercolor':
            this.tilelayer = L.tileLayer("https://watercolormaps.collection.cooperhewitt.org/tile/watercolor/{z}/{x}/{y}.png", {
                attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, served by ' +
                '<a href="https://watercolormaps.collection.cooperhewitt.org/">Cooper Hewitt, Smithsonian Design Museum</a> ' +
                'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ' +
                'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ' +
                'under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
        })
        break;
    case 'stadia':
        var access_token = storymap_config.storymap.map_access_token;
        let style_url = '';
        if (parts.length > 1) {
            style_url = parts.slice(1).join(':') // put the pieces back together
            if (access_token) {
                style_url = `${style_url}?api_key=${access_token}`
            }
        }
        this.tilelayer = new L.TileLayer(style_url, options);
        break;
    case 'stamen':
        this.tilelayer = new KLStoryMap.StamenTileLayer(parts[1]);
        break;
    case 'mapbox':
        // rare legacy may not have a map_access_token configured
        var access_token = storymap_config.storymap.map_access_token || 'pk.eyJ1IjoibnVrbmlnaHRsYWIiLCJhIjoieUpRU1FOWSJ9.f7Z1min5DNfTPBIb7RbnGA';
        if (parts.length > 2) {
            // new form mapbox URL:
            // mapbox://styles/nuknightlab/cjl6w8oio0agu2sltd04tp1kx
            var this_mapbox_map = parts[2].substr('//styles/'.length);
            this.tilelayer = new L.TileLayer("https://api.mapbox.com/styles/v1/" + this_mapbox_map + "/tiles/256/{z}/{x}/{y}@2x?access_token=" + access_token);
            break;
        } else {
            // legacy configuration
            // nuknightlab.cjl6w8oio0agu2sltd04tp1kx
            var mapbox_name = parts[1];
            this.tilelayer = new L.TileLayer("https://api.tiles.mapbox.com/v4/" + mapbox_name + "/{z}/{x}/{y}.png?access_token=" + access_token);
            break;
        }
      case 'osm':
      default: // default case is 'osm'
        options.subdomains = 'ab';
        this.tilelayer = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', options);
        break;
    }
  }
  this.tilelayer.addTo(this.map);
}
