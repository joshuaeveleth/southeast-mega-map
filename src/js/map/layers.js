(function () {
  'use strict';

  var L = require('leaflet');
  var emitter = require('../mediator');
  var _ = require('../util');
  var template = require('../../templates/popup.jade');
  require('leaflet.markercluster');
  require('leaflet-providers');
  require('./marker-cluster-layer-support');

  var offices, control, map, overlays,
      cluster = L.markerClusterGroup.layerSupport({ showCoverageOnHover: false });

  var baseLayers = {
    'ESRI National Geographic': L.tileLayer.provider('Esri.NatGeoWorldMap'),
    'Imagery': L.tileLayer.provider('Esri.WorldImagery')
  };

  var wms = require('./wms');

  function init(officeData, layersOnLoad, theMap) {
    offices = officeData;
    map = theMap;
    overlays = {
      'Refuges': L.layerGroup().addLayer( createOfficeLayer('National Wildlife Refuge') ),
      'Hatcheries': L.layerGroup().addLayer( createOfficeLayer('National Fish Hatchery') ),
      'Ecological Services': L.layerGroup().addLayer( createOfficeLayer('Ecological Services Field Office') ),
      'Fish and Wildlife Conservation Offices': L.layerGroup().addLayer( createOfficeLayer('Fish And Wildlife Conservation Office') )
    };
    control = L.control.layers(baseLayers, overlays);

    if (layersOnLoad) addSomeLayers(overlays, layersOnLoad);
    else addAllLayers(overlays);

    addOverlaysToLayersControl();
    control.addTo(map);
    cluster.addTo(map);

    map.on('overlayadd', layerAdd);
    map.on('overlayremove', layerRemove);
  }

  function addOverlaysToLayersControl() {
    _.map(wms, function(layer, name) {
      control.addOverlay(layer, name);
    });
  }

  function addAllLayers(overlays) {
    _.map(overlays, function(layer, key) {
      cluster.checkIn(layer);
      cluster.addLayer(layer);
    });
  }

  function getBounds() {
    return cluster.getBounds();
  }

  function addSomeLayers(overlays, layers) {
    _.map(overlays, function(layer, key) {
      cluster.checkIn(layer);
      if (_.includes(layers, key.toLowerCase())) cluster.addLayer(layer);
    });

    _.map(wms, function(layer, key) {
      if (_.includes(layers, key.toLowerCase())) map.addLayer(layer);
    });
  }

  function layerAdd(layer) {
    if (layer.layer._wmsVersion) return;
    cluster.addLayer(layer);
  }

  function layerRemove(layer) {
    if (layer.layer._wmsVersion) return;
    cluster.removeLayer(layer);
  }

  function createOfficeLayer(type) {
    return L.geoJson(offices, {
      filter: function (feature, latlng) {
        switch (feature.properties.type) {
          case type: return true;
          default: return false;
        }
      },
      onEachFeature: onEachFeature,
      pointToLayer: pointToLayer
    }).on('mouseover', function(e) {
      e.layer.openPopup();
    });
  }

  function onEachFeature(feature, layer) {
    layer.bindPopup(template({ office: feature.properties }));
    layer.on({ click: onMarkerClick });
  }

  function pointToLayer(feature, latlng) {
    var icons = require('../icons');
    var type = feature.properties.type;
    if (type === 'National Wildlife Refuge') return L.marker(latlng, { icon: icons.blueGoose, alt: 'Official logo of the National Wildlife Refuge System' });
    else if (type === 'National Fish Hatchery') return L.marker(latlng, { icon: icons.fisheries, alt: 'Logo for the U.S. Fish and Wildlife Service Fisheries program' });
    else return L.marker(latlng, { icon: icons.office, alt: 'Icon representing a field station' });
  }

  function onMarkerClick(feature) {
    var office = feature.target.feature;
    flyToOffice(office);
    emitter.emit('marker:click', office);
  }

  function flyToOffice(office) {
    var type = office.properties.type.toLowerCase();
    var filtered = _.filter(cluster.getLayers(), function(layer) {
      return layer.feature == office;
    });
    if (filtered.length === 0) toggleByType(type);
    // Clone the coordinates array
    var latlng = office.geometry.coordinates.slice(0).reverse();
    // Account for detail panel opening
    latlng[1] = latlng[1] - 0.135;
    map.flyTo(latlng, 11);
  }

  function toggleByType(type) {
    if (type.indexOf('ecological') > -1) cluster.addLayer(overlays['Ecological Services']);
    if (type.indexOf('refuge') > -1) cluster.addLayer(overlays.Refuges);
    if (type.indexOf('hatchery') > -1) cluster.addLayer(overlays.Hatcheries);
    if (type.indexOf('conservation') > -1) cluster.addLayer(overlays['Fish and Wildlife Conservation Offices']);
  }

  module.exports = {
    init: init,
    flyToOffice: flyToOffice,
    baseLayers: baseLayers,
    getBounds: getBounds,
    cluster: cluster
  };

})();
