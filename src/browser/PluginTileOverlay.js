
var utils = require('cordova/utils'),
  event = require('cordova-plugin-googlemaps.event'),
  BaseClass = require('cordova-plugin-googlemaps.BaseClass'),
  LatLng = require('cordova-plugin-googlemaps.LatLng');

function TileOverlay(mapId, hashCode, options) {
  var self = this,
    tileSize = 256,
    tileCaches = {};

  var mapType = {
    zIndex: options.zIndex || 0,
    name: options.name || hashCode,
    mapTypeId: hashCode,
    fadeIn: options.fadeIn === false ? false : true,
    visible: true,

    getTileFromCache: function(cacheId) {
      return tileCaches[cacheId];
    },
    getZIndex: function() {
      return this.zIndex;
    },
    setZIndex: function(zIndexVal) {
      this.zIndex = parseInt(zIndexVal, 10);
    },

    opacity: 'opacity' in options ? options.opacity : 1,

    tileSize: new google.maps.Size(tileSize, tileSize),

    setVisible: function(visible) {
      this.visible = visible;
      var visibility = visible ? 'visible': 'hidden';
      var keys = Object.keys(tileCaches);
      keys.forEach(function(key) {
        tileCaches[key].style.visibility = visibility;
      });
    },

    getTile: function(coord, zoom, owner) {

      var cacheId = [mapId, hashCode, coord.x, coord.y, zoom].join("-");
      if (cacheId in tileCaches) {
        return tileCaches[cacheId];
      } else {
        var div = document.createElement('div');
        div.style.width = tileSize + 'px';
        div.style.height = tileSize + 'px';
        div.style.opacity = 0;
        div.style.visibility = 'hidden';

        if (options.debug) {
          div.style.borderLeft = "1px solid red";
          div.style.borderTop = "1px solid red";
          div.style.color = 'red';
          div.style.fontSize = '12px';
          div.style.padding = '1em';
          div.innerHTML = "x = " + coord.x + ", y = " + coord.y + ", zoom = " + zoom;
        }

        div.setAttribute('cacheId', cacheId);
        tileCaches[cacheId] = div;

        options.getTile(coord.x, coord.y, zoom, cacheId);
        return div;
      }
    },

    releaseTile: function(div) {
      var cacheId = div.getAttribute('cacheId');
      delete tileCaches[cacheId];
    }
  };

  return mapType;
}


function PluginTileOverlay(pluginMap) {
  var self = this;
  BaseClass.apply(self);
  Object.defineProperty(self, "pluginMap", {
    value: pluginMap,
    enumerable: false,
    writable: false
  });

}

utils.extend(PluginTileOverlay, BaseClass);

PluginTileOverlay.prototype._create = function(onSuccess, onError, args) {
  var self = this,
    map = self.pluginMap.get('map'),
    hashCode = args[2],
    tileoverlayId = 'tileoverlay_' + hashCode,
    pluginOptions = args[1],
    mapId = self.pluginMap.id,
    getTileEventName = mapId + "-" + hashCode + "-tileoverlay";

  pluginOptions.getTile = function(x, y, zoom, urlCallbackId) {
    cordova.fireDocumentEvent(getTileEventName, {
      key: urlCallbackId,
      x: x,
      y: y,
      zoom: zoom
    });
  };

  var tileoverlay = new TileOverlay(self.pluginMap.id, hashCode, pluginOptions);

  var layers = map.overlayMapTypes.getArray();
  layers = layers.filter(function(layer) {
    return !!layer;
  });
  layers.forEach(function(layer, idx) {
    if (!layer) {
      return;
    }
    if (layer.zIndex === undefined) {
    layer.zIndex = idx;
    }
    if (!layer.getZIndex) {
      layer.getZIndex = function() {
        return layer.zIndex;
      };
    }
    if (!layer.setZIndex) {
      layer.setZIndex = function(zIndexVal) {
        layer.zIndex = zIndexVal;
      };
    }
  });
  layers.push(tileoverlay);
  layers = layers.sort(function(a, b) {
    return a.getZIndex() - b.getZIndex();
  });
  layers.forEach(function(layer, idx) {
    if (idx < map.overlayMapTypes.getLength()) {
      layer.zIndex = idx;
      map.overlayMapTypes.setAt(idx, layer);
    } else {
      layer.zIndex = idx;
      map.overlayMapTypes.push(layer);
    }
  });

  self.pluginMap.objects[tileoverlayId] = tileoverlay;

  onSuccess({
    'id': tileoverlayId
  });
};


PluginTileOverlay.prototype.onGetTileUrlFromJS = function(onSuccess, onError, args) {

  var self = this,
    cacheId = args[1],
    tileUrl = args[2];

  var tmp = cacheId.split(/\-/),
    hashCode = tmp[1],
    tileoverlayId = 'tileoverlay_' + hashCode;

  var tileLayer = self.pluginMap.objects[tileoverlayId];

  if (tileLayer.getTileFromCache(cacheId)) {
    var tile = tileLayer.getTileFromCache(cacheId);
    tile.style.backgroundImage = "url('" + tileUrl + "')";
    tile.style.visibility = tileLayer.visible ? 'visible': 'hidden';

    if (tileLayer.fadeIn) {
      fadeIn(tile, 500, tileLayer.opacity);
    } else {
      tile.style.setOpacity = tileLayer.opacity;
    }
  }
  onSuccess();
};

PluginTileOverlay.prototype.setVisible = function(onSuccess, onError, args) {
  var self = this;
  var overlayId = args[0];
  var tileoverlay = self.pluginMap.objects[overlayId];
  if (tileoverlay) {
    tileoverlay.setVisible(args[1]);
  }
  onSuccess();
};

PluginTileOverlay.prototype.setFadeIn = function(onSuccess, onError, args) {
  var self = this;
  var overlayId = args[0];
  var tileoverlay = self.pluginMap.objects[overlayId];
  if (tileoverlay) {
    tileoverlay.fadeIn = args[1] === false ? false : true;
  }
  onSuccess();
};
PluginTileOverlay.prototype.setZIndex = function(onSuccess, onError, args) {
  var self = this;
  var overlayId = args[0];
  var map = self.pluginMap.get('map');
  var tileoverlay = self.pluginMap.objects[overlayId];
  if (tileoverlay) {
    tileoverlay.setZIndex(args[1]);

    var layers = map.overlayMapTypes.getArray();
    layers = layers.sort(function(a, b) {
      return a.getZIndex() - b.getZIndex();
    });
    layers.forEach(function(layer, idx) {
      if (idx < map.overlayMapTypes.getLength()) {
        map.overlayMapTypes.setAt(idx, layer);
      } else {
        map.overlayMapTypes.push(layer);
      }
    });

  }


  onSuccess();
};

PluginTileOverlay.prototype.remove = function(onSuccess, onError, args) {
  var self = this;
  var overlayId = args[0];
  var tileoverlay = self.pluginMap.objects[overlayId];
  if (tileoverlay) {
    google.maps.event.clearInstanceListeners(tileoverlay);
    tileoverlay.setMap(null);
    tileoverlay = undefined;
    self.pluginMap.objects[overlayId] = undefined;
    delete self.pluginMap.objects[overlayId];
  }
  onSuccess();
};

module.exports = PluginTileOverlay;

function fadeIn(el, time, maxOpacity) {
  el.style.opacity = 0;

  var last = +new Date();
  var tick = function() {
    el.style.opacity = +el.style.opacity + (new Date() - last) / time;
    last = +new Date();

    if (+el.style.opacity < maxOpacity) {
      (window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
    }
  };

  tick();
}