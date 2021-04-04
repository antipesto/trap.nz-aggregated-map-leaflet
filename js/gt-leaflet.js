var $ = jQuery;

function buildMap(opts, map) {
  if (map) {
    if (opts.options.minZoom) map.setMinZoom(opts.options.minZoom);
    if (opts.options.maxZoom) map.setMaxZoom(opts.options.maxZoom);
  } else {
    if (opts.fullscreen) {
      $('html, body, ' + opts.selector).css('width', '100%').css('height', '100%');
      $(opts.selector).height($(window).height()).width($(window).width());
    }
    var map = new L.map(opts.id, opts.options);
  }
  map.map_opts = opts;


  if (opts.boundsPadding) {
    map.setMaxBounds(map.getBounds().pad(opts.boundsPadding));
  }

  if (opts.panes) {
    for (var panename in opts.panes) {
      var pane = map.createPane(panename);
      pane.style.zIndex = opts.panes[panename].style.zIndex;
      if (pane.style.pointerEvents) {
        opts.panes[panename].style.pointerEvents = pane.style.pointerEvents;
      }
    }
  }

  map.base_layers = {};
  for (var basename in opts.layers.base) {
    var base = opts.layers.base[basename];
    if (base.layergroup) {
      var group_layers = [];
      for (var l=0; l<base.layers.length; l++) {
        var lyr = base.layers[l];
        group_layers.push(L.tileLayer(lyr.url, lyr.settings));
      }
      map.base_layers[base.label] = L.layerGroup(group_layers);
    } else {
      map.base_layers[base.label] = L.tileLayer(base.url, base.settings);
    }
    if (base.visible) map.base_layers[base.label].addTo(map);
  }

  map.overlay_layers = {};
  for (var overlayname in opts.layers.overlay) {
    var overlay = opts.layers.overlay[overlayname];
    if (overlay.layergroup) {
      var group_layers = [];
      for (var l=0; l<overlay.layers.length; l++) {
        var lyr = overlay.layers[l];
        group_layers.push(createLayer(map, lyr));
      }
      map.overlay_layers[overlay.label] = L.layerGroup(group_layers);
    } else {
      map.overlay_layers[overlay.label] = createLayer(map, overlay);
    }
    if (overlay.visible) {
      map.overlay_layers[overlay.label].addTo(map);
    }
  }

  if (opts.controls.layerswitcher) {
    var layer_control = L.control.layers(map.base_layers, map.overlay_layers);
    layer_control.addTo(map);
    map.layer_control = layer_control;
  }

  if (opts.controls.legends) {
    map.legends = {};
    for (var legend_id in opts.controls.legends) {
      (function(legend_id) { // preserve scope of legend_id in closure
        var legend_opts = opts.controls.legends[legend_id]
        if (legend_opts.ajax) {
          if (!legend_opts.legends) legend_opts.legends = [];
          if (legend_opts.ajax.success) {
            var custom_success = legend_opts.ajax.success;
            legend_opts.ajax.success = function(data) {
              legend_opts.legends.push({ elements: [{ html: legend_opts.ajax.html(data, legend_id, legend_opts) }]});
              custom_success(data, map, legend_id, legend_opts);
            }
          } else {
            legend_opts.ajax.success = function(data) {
              legend_opts.legends.push({ elements: [{ html: legend_opts.ajax.html(data, map, legend_id, legend_opts) }]});
              var legend = L.control.htmllegend(legend_opts);
              map.legends[legend_id] = legend;
              if (legend_opts.visible) map.addControl(legend);
            }
          }
          if (legend_opts.ajax.waitForEvent) {
            // subscribe to custom event
            document.addEventListener(legend_opts.ajax.waitForEvent, function(e) {
              ajaxLoad(map, legend_opts.ajax, arguments);
            }, false);

          } else {
            ajaxLoad(map, legend_opts.ajax);
          }
        } else {
          var legend = L.control.htmllegend(legend_opts);
          map.legends[legend_id] = legend;
          if (legend_opts.visible) map.addControl(legend);
        }
      })(legend_id);
    }
  }

  if (opts.controls.attribution) {
    if (opts.controls.attribution.prefix) {
      map.attributionControl.setPrefix(opts.controls.attribution.prefix);
    }
  }

  if (opts.controls.watermark) {
    if (opts.controls.watermark.insertBeforeZoom) map.zoomControl.remove();
    new L.control.watermark(opts.controls.watermark).addTo(map);
    if (opts.controls.watermark.insertBeforeZoom) new L.Control.Zoom({ position: 'topleft' }).addTo(map);
  }

  if (opts.controls.fullscreen) map.addControl(new L.Control.Fullscreen());
  if (opts.controls.locate) L.control.locate(opts.controls.locate).addTo(map);
  if (opts.controls.scale) L.control.scale(opts.controls.scale).addTo(map);

  // subscribe to custom layer_load event
  document.addEventListener('map_layers_loaded', onMapLayerLoad, false);

  // fix layer order every time a layer is enabled in the UI
  map.on('overlayadd', function (e) {
    if (map.layer_control._handlingClick) { // Executes only on UI toggle
      fixLayerOrder(map);
    }
  });

  // fix fullscreen map bounds change
  map.on('fullscreenchange', function() {
    map.invalidateSize();
  });

  return map;
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

function createLayer(map, layer_opts) {
  // console.log(layer_opts.label);
  // console.log(layer_opts);
  switch (layer_opts.layerType) {

    case 'L.geoJSON':
      var layer = null;
      if (!layer_opts.settings.pointToLayer) {
        switch (layer_opts.settings.markerType) {
          case 'circle':
            layer_opts.settings.pointToLayer = function (feature, latlng) {
              return L.circleMarker(latlng);
            }
          break;
          case 'icon':
            layer_opts.settings.pointToLayer = function (feature, latlng) {
              return L.marker(latlng, {icon: L.icon(layer_opts.settings.style)});
            }
          break;
          default: // marker
            layer_opts.settings.pointToLayer = function (feature, latlng) {
              return L.marker(latlng);
            }
          break;
        }
      }

      if (layer_opts.data) {
        // local data, not loaded from URL
        layer = new L.geoJSON(layer_opts.data, layer_opts.settings);
        if (layer_opts.onData) {
          layer_opts.onData(map, layer, layer_opts.data, layer_opts.settings);
        }
        if (layer_opts.init) {
          layer_opts.init(map, layer, layer_opts);
        }

      } else if (layer_opts.ajax) {
        layer = new L.geoJSON(null, layer_opts.settings);
        var custom_success = layer_opts.ajax.success;
        layer_opts.ajax.success = function(data) {
          if (custom_success) {
            custom_success(data, map, layer, layer_opts);
          } else {
            layer.addData(data.features);
          }
          if (layer_opts.init) {
            layer_opts.init(map, layer, layer_opts);
          }
        }
        if (layer_opts.ajax.waitForEvent) {
          // subscribe to custom event
          document.addEventListener(layer_opts.ajax.waitForEvent, function(e) {
            ajaxLoad(map, layer_opts.ajax, arguments);
          }, false);

        } else {
          ajaxLoad(map, layer_opts.ajax);
        }
      }

      return layer;
    break;

    case 'L.markerClusterGroup':
      var layer = null;
      if (!layer_opts.settings.pointToLayer) {
        layer_opts.settings.pointToLayer = function (feature, latlng) {
          return L.marker(latlng);
        }
      }

      if (layer_opts.data) {
        // local data, not loaded from URL
        // layer = new L.geoJSON(layer_opts.data, layer_opts.settings);
        // if (layer_opts.onData) {
        //   layer_opts.onData(map, layer, layer_opts.data, layer_opts.settings);
        // }

      } else if (layer_opts.ajax) {
        layer = new L.markerClusterGroup(layer_opts.settings);
        var custom_success = layer_opts.ajax.success;
        layer_opts.ajax.success = function(data) {
          if (custom_success) {
            custom_success(data, map, layer, layer_opts);
          } else {
            for (var i = 0; i < data.features.length; i++) {
              var feature = data.features[i];
              var marker = L.marker(L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]));
              layer.addLayer(marker);
            }
          }
        }
        if (layer_opts.ajax.waitForEvent) {
          // subscribe to custom event
          document.addEventListener(layer_opts.ajax.waitForEvent, function(e) {
            ajaxLoad(map, layer_opts.ajax, arguments);
          }, false);

        } else {
          ajaxLoad(map, layer_opts.ajax);
        }
      }

      if (layer_opts.init) {
        layer_opts.init(map, layer, layer_opts);
      }

      return layer;
    break;

    case 'L.HexbinLayer':
      var layer = L.hexbinLayer(layer_opts.settings);
      if (layer_opts.settings.colorScale) {
        layer.colorScale().range(layer_opts.settings.colorScale);
      }

      // assume lat and lng are taken from geojson data unless overridden
      if (!layer_opts.settings.lat) {
        layer_opts.settings.lat = function(d) {
          return d.geometry.coordinates[1];
        }
      }
      layer.lat(layer_opts.settings.lat);
      if (!layer_opts.settings.lng) {
        layer_opts.settings.lng = function(d) {
          return d.geometry.coordinates[0];
        }
      }
      layer.lng(layer_opts.settings.lng);

      if (layer_opts.settings.hoverHandlers) {
        var hovhnd = layer_opts.settings.hoverHandlers;
        var hover_handlers = [];
        if (hovhnd.tooltip) {
          hover_handlers.push(L.HexbinHoverHandler.tooltip({ tooltipContent: hovhnd.tooltip }));
        }
        if (hovhnd.scale) {
          hover_handlers.push(L.HexbinHoverHandler.resizeScale(hovhnd.scale));
        }
        layer.hoverHandler(L.HexbinHoverHandler.compound({ handlers: hover_handlers }));
      }

      if (layer_opts.settings.colorValue) {
        layer.colorValue(layer_opts.settings.colorValue);
      }

      if (layer_opts.data) {
        // local data, not loaded from URL
        layer.data(layer_opts.data.features);

      } else if (layer_opts.ajax) {
        var custom_success = layer_opts.ajax.success;
        layer_opts.ajax.success = function(data) {
          if (custom_success) {
            custom_success(data, map, layer, layer_opts);
          } else {
            layer.data(data.features);
          }
        }
        if (layer_opts.ajax.waitForEvent) {
          // subscribe to custom event
          document.addEventListener(layer_opts.ajax.waitForEvent, function(e) {
            ajaxLoad(map, layer_opts.ajax, arguments);
          }, false);

        } else {
          ajaxLoad(map, layer_opts.ajax);
        }
      }

      if (layer_opts.init) {
        layer_opts.init(map, layer, layer_opts);
      }

      return layer;
    break;

    default:
      var layer = eval(`new ${layer_opts.layerType}(layer_opts.url, layer_opts.settings)`);
      if (layer_opts.init) {
        layer_opts.init(map, layer, layer_opts);
      }
      return layer;

  }
  return null;
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

L.Control.Watermark = L.Control.extend({
  onAdd: function(map) {
    var img = L.DomUtil.create('img');
    img.src = this.options.src;
    img.style.width = this.options.width;
    img.style.height = this.options.height;
    img.style.opacity = this.options.opacity;
    return img;
  },
});
L.control.watermark = function(opts) {
  return new L.Control.Watermark(opts);
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

if (L.hexbinLayer) {
  // ensure hexes are removed when the layer is removed
  L.HexbinLayer.prototype.onRemove = function(map) {
    L.SVG.prototype.onRemove.call(this);
    // Destroy the svg container
    this._destroyContainer();
    d3.select(this._container).remove();
    // Remove events
    map.off({ 'moveend': this.redraw }, this);
    this._map = null;
  };
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

function ajaxLoad(map, opts) {
  addSpinner(map);
  var old_complete = opts.complete;
  // disable jsonp for security
  opts.jsonp = false;
  opts.complete = function(jqXHR, textStatus) {
    removeSpinner(map);
    if (old_complete) old_complete(jqXHR, textStatus);
  }
  if (typeof opts.url === 'function') {
    opts.url = opts.url();
  }
  $.ajax(opts);
}

function addSpinner(map) {
  if (!map.spinners) {
    map.spinners = 0;
    var spinnerContent = '<div class="lds-dual-ring"></div>';
    var mapContainer = map.getContainer();
    $(mapContainer).parent().css('position', 'relative');
    $(spinnerContent).insertBefore(mapContainer);
  }
  map.spinners++;
}
function removeSpinner(map) {
  map.spinners--;
  if (!map.spinners) {
    // remove the spinner
    $('.lds-dual-ring').fadeOut(1000, function() { $(this).remove(); });
    // trigger custom layer_load event
    var map_layers_loaded = new CustomEvent('map_layers_loaded');
    map_layers_loaded.map = map;
    document.dispatchEvent(map_layers_loaded);
  }
}

function onMapLayerLoad (e) {
  var map = e.map;
  fixLayerOrder(map);
}

function fixLayerOrder(map) {
  if (map.layer_control) {
    var layers = map.layer_control._layers;
    for (var i in layers) {
      var layer = layers[i];
      if (layer.overlay) {
        if (layer.layer && layer.layer.bringToFront) {
          layer.layer.bringToFront();
        }
      }
    }
  }
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

// Get querystring parameter from URL
function param(name) {
  // NOTE: replaced by queryParam() function. Left here for legacy continuity.

  // name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  // var regexS = "[\\?&]"+name+"=([^&#]*)";
  // var regex = new RegExp( regexS );
  // var results = regex.exec( window.location.href );
  // if ( results == null ) {
  //   return "";
  // } else {
  //   return decodeURIComponent(results[1]);
  // }
  return queryParam(name);
}

function queryParam(key) {
  const groupParamsByKey = (params) => [...params.entries()].reduce((acc, tuple) => {
   // getting the key and value from each tuple
   const [key, val] = tuple;
   if(acc.hasOwnProperty(key)) {
      // if the current key is already an array, we'll add the value to it
      if(Array.isArray(acc[key])) {
        acc[key] = [...acc[key], val]
      } else {
        // if it's not an array, but contains a value, we'll convert it into an array
        // and add the current value to it
        acc[key] = [acc[key], val];
      }
   } else {
    // plain assignment if no special case is present
    acc[key] = val;
   }

   return acc;
  }, {});

  var search = location.search.substring(1);
  var urlParams = new URLSearchParams(search);
  var params = groupParamsByKey(urlParams);

  if (key) {
    if (params[key]) return params[key];
    if (params[key + '[]']) return params[key + '[]'];
  } else {
    return params;
  }
}


// get URL path arg e.g. http://x.com/a/b/c.html arg(0) = a, arg(1) = b
function arg(index) {
  var pathArray = window.location.pathname.split('/');
  // the first element will be empty because the path starts with a /
  return pathArray[index + 1];
}

function createRelativeDate(days, months, years) {
  var date = new Date();
  date.setDate(date.getDate() + days);
  date.setMonth(date.getMonth() + months);
  date.setFullYear(date.getFullYear() + years);
  return date;
}
function datestringYMD(date) {
  if (!date) date = new Date();
  month = '' + (date.getMonth() + 1),
  day = '' + date.getDate(),
  year = date.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toPoints(d) {
  var points = [];
  for (var i=0; i<d.length; i++) {
    points[i] = L.marker(d[i].geometry.coordinates);
  }
  return points;
}

///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\

var linz_basemap_settings = {
  maxZoom: 22,
  maxNativeZoom: 18,
  subdomains: '1234',
  attribution: '<a href="https://www.linz.govt.nz/linz-copyright" target="_blank">Basemap sourced from LINZ. CC-BY 4.0</a>',
  zIndex: 2
};
var linz_proj = 'GLOBAL_MERCATOR'; // 'NZTM';
