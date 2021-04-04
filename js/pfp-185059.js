var project_name = 'Pest Free Plimmerton'
var project_list = {
    185059:"pest-free-plimmerton/",
  }
var project_id = 185059 
  
  var map_opts = {
    id: 'trapMap',
    selector: '#trapMap',
  
    options: { // leaflet map constructor options
      center: [-41.0763712,174.8672162],
      zoom: 14,
      minZoom: 11,
      maxZoom: 14,
    },
    boundsPadding: 0.5,
  
    panes: {
      hexes: {
        style: {
          zIndex: 200
        }
      },
    },
  
    layers: {
      base: {
        linz_colour_basemap: {
          layergroup: true,
          visible: true,
          label: 'LINZ Colour Basemap',
          layers: [
            {
              label: 'LINZ NZ Basemap',
              url: 'https://tiles{s}.maps.linz.io/nz_colour_basemap/' + linz_proj + '/{z}/{x}/{y}.png',
              settings: linz_basemap_settings,
            },
            {
              label: 'LINZ Basemap Labels',
              url: 'https://tiles{s}.maps.linz.io/nz_colour_basemap_labels/' + linz_proj + '/{z}/{x}/{y}.png',
              settings: linz_basemap_settings,
            },
          ],
        },
      },
  
      overlay: {


        catches_hex: {
          label: 'Catch summary hexes',
          layerType: 'L.HexbinLayer',
          ajax: {
            url: catchesHexURL('https://io.trap.nz/maps/trap-killcount?'),
            dataType: 'json',
            success: catchesHexData,
          },
          init: catchesHexInit,
          visible: true,
          settings: {
            radius: 13,
            radiusRange: [13, 13],
            opacity: 0.7,
            duration: 0,
            minZoom: 0, // hide below this zoom
            maxZoom: 14, // increase size above this zoom
            colorScale: ['#FFFFCC', 'yellow', 'orange', 'red', 'brown'],
            allowedSpecies: ['None', 'Other', 'Ferret', 'Hedgehog', 'Mouse', 'Possum', 'Rabbit', 'Rat', 'Stoat', 'Weasel'],
            hoverHandlers: {
              tooltip: catchesHexTooltip,
              scale: { radiusScale: 0.5 },
            },
            colorValue: catchesHexColorValue,
            pane: 'hexes',
          },
        },
      },
  
    },
  
    fullscreen: true,
    controls: {
      fullscreen: false,
      scale: { imperial: false },
      layerswitcher: false,
  
      // attribution: { prefix: 'Created for <a href="https://www.trap.nz"><strong><span style="color:#bd1f2d;">TRAP</span><span style="color:black">.NZ</span></strong></a> by <a href="https://www.groundtruth.co.nz"><span style="font-family:serif; font-size: 1.2em; color:black"><strong>ground<span style="color:#2e7a34">truth</span></strong></span></a>' },
  
      legends: {
        gt_attribution: {
          position: 'bottomright',
          visible: true,
          legends: [{
            elements: [{
              html: '<style type="text/CSS"><!-- .leaflet-bar .legend-block a, .leaflet-bar .legend-block a:hover { display: inline; } .legend-block { margin: 0 !important; } --></style><div>Data sourced from <a href="https://www.trap.nz"><strong><span style="color:#bd1f2d;">TRAP</span><span style="color:black">.NZ</span></strong></a> by <a href="https://www.groundtruth.co.nz"><span style="font-family:serif; font-size: 1.2em; color:black"><strong>ground<span style="color:#2e7a34">truth</span></strong></span></a></div>',
              style: { 'font-size': '0.6em', 'margin': '0 0.5em' },
            }],
          }],
        },
  
        catch_summary: {
          position: 'bottomleft',
          visible: true,
          ajax: {
            url: projectBoundaryURL('https://trap.nz/project/trap-stats-shape.geojson?'),
            html: catchSummaryHTML,
          },
          style: { 'font-size': '0.6em', 'margin': '0 0.5em' },
        },
      },
     
   /* summary_info: {
      position: 'bottomleft',
      visible: true,
      ajax: {
        url: '/project/' + project_id + '/killcount.json',
        dataType: 'json',
        html: summaryInfoHTML,
      },
    }, */
      watermark: {
        src: '/sites/all/themes/trapp_bootstrap/images/trap-logo-watermark.png',
        width: '110px',
        height: '30px',
        opacity: 0.7,
        position: 'topleft',
        insertBeforeZoom: true,
      }
    }
  };
  
  var map = buildMap(map_opts);
  
  ///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\
  // Trap hex layer //
  
  function projectBoundaryURL(base_url) {
    var url = base_url;
    for(var key in project_list) {
      url += 'id[]=' + key + '&';
    }
    return url;
  }
  
  function catchesHexURL(base_url) {
    var url = base_url;
    var project_ids = Object.keys(project_list);
    var project_ids_imploded = project_ids.join(',');
    url += 'projects=' + project_ids_imploded;
    return url;
  }
  
  function catchesHexInit(map, layer, opts) {
    map.on('zoomend', function(e) {
      var zoom = e.target._zoom;
      var zoomDiff = zoom - opts.settings.maxZoom;
      var newRadius = opts.settings.radius;
      if (zoomDiff >= 1) {
        newRadius = opts.settings.radius * (2**zoomDiff);
      }
  
      layer.radius(newRadius);
      layer.radiusRange([newRadius, newRadius]);
      map.strikesHexLayer.radius(newRadius);
      map.strikesHexLayer.radiusRange([newRadius/2, newRadius/2]);
  
      if (zoom >= opts.settings.minZoom) {
        map.addLayer(layer);
      } else {
        map.removeLayer(layer);
      }
    });
  }

  
  function catchesHexData(data, map, layer, opts) {
    // feed data into hexmap layer
    layer.data(data.features);
    // create interior sub-hexes for strikes density
    var strikes_opts = opts;
    strikes_opts.init = null;
    strikes_opts.ajax = null;
    strikes_opts.data = data;
    strikes_opts.settings.radiusRange = [6, 6];
    strikes_opts.settings.colorValue = strikesHexColorValue;
    var strikesHexLayer = createLayer(map, strikes_opts);
    strikesHexLayer.addTo(map);
    map.strikesHexLayer = strikesHexLayer;
  }
  
  function catchesHexTooltip(d) {
    var strikes = sumStrikes(d);
    var out = 'Traps: ' + strikes.total_traps + '<br />';
    out += 'Catches: ' + strikes.total_strikes + '<br />';
    for (var s in strikes.species) {
      out += '&nbsp;' + s + ': ' + strikes.species[s] + '<br />';
    }
    return out;
  }
  
  function catchesHexColorValue(d) {
    return sumTraps(d);
  }
  
  function strikesHexColorValue(d) {
    return sumStrikes(d).total_strikes;
  }
  
  function sumTraps(d) {
    var traps = 0;
    for (var i=0; i<d.length; i++) {
      if (d[i].o) {
        traps += d[i].o.properties.traps;
      } else {
        traps += d[i].properties.traps;
      }
    }
    return traps;
  }
  
  function sumStrikes(d, total_only) {
    var strikes = { 'total_traps': 0, 'total_strikes': 0, 'species': {} };
    for (var i=0; i<d.length; i++) {
      if (d[i].o) {
        strikes.total_traps += d[i].o.properties.traps;
        strikes.total_strikes += d[i].o.properties.kill_count;
      } else {
        strikes.total_traps += d[i].properties.traps;
        strikes.total_strikes += d[i].properties.kill_count;
      }
      if (!total_only) {
        var species = d[i].o.properties.species;
        var allowedSpecies = map_opts.layers.overlay.catches_hex.settings.allowedSpecies;
        for (var s in species) {
          var count = species[s];
          if (allowedSpecies.indexOf(s) == -1) {
            if (['Rat - Ship', 'Rat - Norway', 'Rat - Kiore'].indexOf(s) != -1) {
              s = 'Rat';
            } else {
              // species not in allowed species list, make 'Other'
              s = 'Other';
            }
          }
          if (!strikes.species[s]) strikes.species[s] = 0;
          strikes.species[s] += count;
        }
      }
    }
    return strikes;
  }
  
  
  ///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\
  // Summary info legend //
  
  function catchSummaryHTML(data) {
    var totalKills = 0;
    var totalTraps = 0;
    $(data.features).each(function(key, data) {
      totalKills += data['properties']['Total kills'];
      totalTraps += data['properties']['Trap count'];
    });
  
    //totals legend
    var html = '<p><h2>' + project_name + '</h2></p><br><hr>';
    html += '<p><strong>'+ numberWithCommas(totalKills) + '</strong> total pests killed';
    html += '<br /><strong>'+ numberWithCommas(totalTraps) +'</strong> traps deployed</p>';
  
    return html;
  }
  
  function summaryInfoHTML(data) {
    var html = `
    <div id="killstat-wrapper" style="font-size: 0.7em; padding: 0.5em;">
      <table class="killstat-summary">
        <tbody>
          <tr>
            <th>Traps:</th>
            <td>` + data.traps + `</td>
          </tr>
          <tr>
            <th>Bait&nbsp;stations:</th>
            <td>` + data.baitstations + `</td>
          </tr>
        </tbody>
      </table>`;

      if (data.killCount_year) {
        html += `
        <table class="killstat-counts">
          <thead>
            <tr>
              <th></th>
              <th>Project</th>
              <th>Year</th>
              <th>Month</th>
            </tr>
          </thead>
          <tbody>`;
            for (var name in data.species_kills.family) {
              var value = data.species_kills.family[name];
              if (value.projectTotal) {
                html += `
                <tr>
                  <th>` + name + `</th>
                  <td>` + value.projectTotal + `</td>
                  <td>` + value.yearTotal + `</td>
                  <td>` + value.monthTotal + `</td>
                </tr>`;
              }
            }
            html += `
            <tr>
              <th>Total:</th>
              <th>` + data.killCount_project + `</th>
              <th>` + data.killCount_year + `</th>
              <th>` + data.killCount_month + `</th>
            </tr>
          </tbody>
        </table>`;
      }
    html += `</div>`;

    return html;
  }