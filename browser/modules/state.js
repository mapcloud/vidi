/**
 * @fileoverview Description of file, its uses and information
 * about its dependencies.
 */

'use strict';

/**
 * @type {*|exports|module.exports}
 */
var cloud;

/**
 * @type {*|exports|module.exports}
 */
var setting;

/**
 * @type {*|exports|module.exports}
 */
var baseLayer;

/**
 * @type {*|exports|module.exports}
 */
var setBaseLayer;

/**
 * @type {*|exports|module.exports}
 */
var switchLayer;

/**
 * @type {*|exports|module.exports}
 */
var legend;

/**
 * @type {*|exports|module.exports}
 */
var draw;

/**
 * @type {*|exports|module.exports}
 */
var advancedInfo;

/**
 * @type {*|exports|module.exports}
 */
var meta;

/**
 * @type {*|exports|module.exports}
 */
var urlparser = require('./urlparser');

/**
 * @type {string}
 */
var hash = urlparser.hash;

/**
 * @type {array}
 */
var urlVars = urlparser.urlVars;

/**
 *
 * @type {LZString|exports|module.exports}
 */
var lz = require('lz-string');

/**
 *
 * @type {exports|module.exports}
 */
var base64 = require('base64-url');

/**
 *
 * @type {string}
 */
var BACKEND = require('../../config/config.js').backend;

var layers;

var backboneEvents;

var layerTree;

var p, hashArr = hash.replace("#", "").split("/");


/**
 *
 * @type {{set: module.exports.set, init: module.exports.init}}
 */
module.exports = {
    /**
     *
     * @param o
     * @returns {exports}
     */
    set: function (o) {
        cloud = o.cloud;
        setting = o.setting;
        setBaseLayer = o.setBaseLayer;
        baseLayer = o.baseLayer;
        switchLayer = o.switchLayer;
        legend = o.legend;
        draw = o.draw;
        layers = o.layers;
        advancedInfo = o.advancedInfo;
        meta = o.meta;
        layerTree = o.layerTree;
        backboneEvents = o.backboneEvents;
        return this;
    },
    setExtent: function () {
        if (hashArr[1] && hashArr[2] && hashArr[3]) {
            p = geocloud.transformPoint(hashArr[2], hashArr[3], "EPSG:4326", "EPSG:900913");
            cloud.get().zoomToPoint(p.x, p.y, hashArr[1]);
        } else {
            cloud.get().zoomToExtent();
        }
    },
    init: function () {
        var arr, i;
        if (hashArr[0]) {
            $(".base-map-button").removeClass("active");
            $("#" + hashArr[0]).addClass("active");
            if (hashArr[1] && hashArr[2] && hashArr[3]) {
                setBaseLayer.init(hashArr[0]);
                if (hashArr[4]) {
                    arr = hashArr[4].split(",");
                    for (i = 0; i < arr.length; i++) {
                        switchLayer.init(arr[i], true, false);
                    }
                }
            }
            legend.init();
        } else {
            // Set base layer to the first added one.
            setBaseLayer.init(baseLayer.getBaseLayer()[0]);
            var extent = setting.getExtent();
            if (extent !== null) {
                if (BACKEND === "cartodb") {
                    cloud.get().map.fitBounds(extent);
                } else {
                    cloud.get().zoomToExtent(extent);
                }
            } else {
                cloud.get().zoomToExtent();
            }
        }
        if (typeof urlVars.k !== "undefined") {
            var parr, v, l, t, GeoJsonAdded = false;
            parr = urlVars.k.split("#");
            if (parr.length > 1) {
                parr.pop();
            }
            $.ajax({
                dataType: "json",
                method: "get",
                url: '/api/postdata/',
                data: {
                    k: parr.join()
                },
                scriptCharset: "utf-8",
                success: function (response) {
                    if (response.data.bounds !== null) {
                        var bounds = response.data.bounds;
                        cloud.get().map.fitBounds([bounds._northEast, bounds._southWest], {animate: false})
                    }
                    if (response.data.customData !== null) {
                        backboneEvents.get().trigger("on:customData", response.data.customData);
                    }
                    /**
                     * Recreate print
                     */
                    if (response.data.print !== null) {
                        GeoJsonAdded = false;
                        parr = response.data.print;
                        v = parr;
                        $.each(v[0].geojson.features, function (n, m) {
                            if (m.type === "Rectangle") {
                                var g = L.rectangle([m._latlngs[0], m._latlngs[2]], {
                                    fillOpacity: 0,
                                    opacity: 1,
                                    color: 'red',
                                    weight: 1
                                });
                                g.feature = m.feature;
                                cloud.get().map.addLayer(g);
                                setTimeout(function () {
                                    var bounds = g.getBounds(),
                                        sw = bounds.getSouthWest(),
                                        ne = bounds.getNorthEast(),
                                        halfLat = (sw.lat + ne.lat) / 2,
                                        midLeft = L.latLng(halfLat, sw.lng),
                                        midRight = L.latLng(halfLat, ne.lng),
                                        scaleFactor = ($("#pane1").width() / (cloud.get().map.project(midRight).x - cloud.get().map.project(midLeft).x));

                                    $("#container1").css("transform", "scale(" + scaleFactor + ")");
                                    $(".leaflet-control-graphicscale").prependTo("#scalebar").css("transform", "scale(" + scaleFactor + ")");
                                    $(".leaflet-control-graphicscale").prependTo("#scalebar").css("transform-origin", "left bottom 0px");
                                    $("#scale").html("1 : " + response.data.scale);
                                    $("#title").html(decodeURIComponent(urlVars.t));
                                    parr = urlVars.c.split("#");
                                    if (parr.length > 1) {
                                        parr.pop();
                                    }
                                    $("#comment").html(decodeURIComponent(parr.join()));
                                    cloud.get().map.removeLayer(g);
                                }, 300)
                            }
                        });
                    }

                    /**
                     * Recreate Drawings
                     */
                    if (response.data.draw !== null) {
                        GeoJsonAdded = false;
                        parr = response.data.draw;
                        v = parr;
                        draw.control();
                        l = draw.getLayer();
                        t = draw.getTable();

                        $.each(v[0].geojson.features, function (n, m) {

                            // If polyline or polygon
                            // ======================
                            if (m.type === "Feature" && GeoJsonAdded === false) {
                                var json = L.geoJson(m, {
                                    style: function (f) {
                                        return f.style;
                                    }
                                });

                                var g = json._layers[Object.keys(json._layers)[0]];
                                l.addLayer(g);
                            }

                            // If circle
                            // =========
                            if (m.type === "Circle") {
                                g = L.circle(m._latlng, m._mRadius, m.style);
                                g.feature = m.feature;
                                l.addLayer(g);
                            }

                            // If rectangle
                            // ============
                            if (m.type === "Rectangle") {
                                g = L.rectangle([m._latlngs[0], m._latlngs[2]], m.style);
                                g.feature = m.feature;
                                l.addLayer(g);
                            }

                            // If marker
                            // =========
                            if (m.type === "Marker") {
                                g = L.marker(m._latlng, m.style);
                                g.feature = m.feature;

                                // Add label
                                if (m._vidi_marker_text) {
                                    g.bindLabel(m._vidi_marker_text, {noHide: true}).on("click", function () {
                                    }).showLabel();
                                }
                                l.addLayer(g);

                            } else {

                                // Add measure
                                if (m._vidi_measurementLayer) {
                                    g.showMeasurements(m._vidi_measurementOptions);
                                }

                                // Add extremities
                                if (m._vidi_extremities) {
                                    g.showExtremities(m._vidi_extremities.pattern, m._vidi_extremities.size, m._vidi_extremities.where);
                                }

                                // Bind popup
                                g.on('click', function (event) {

                                    draw.bindPopup(event);

                                });
                            }
                        });
                        t.loadDataInTable();
                        draw.control();
                    }

                    /**
                     * Recreate query draw
                     */
                    if (response.data.queryDraw !== null) {
                        GeoJsonAdded = false;
                        parr = response.data.queryDraw;
                        v = parr;
                        l = advancedInfo.getDrawLayer();
                        $.each(v[0].geojson.features, function (n, m) {
                            if (m.type === "Feature" && GeoJsonAdded === false) {
                                var g = L.geoJson(v[0].geojson, {
                                    style: function (f) {
                                        return f.style;
                                    }
                                });
                                $.each(g._layers, function (i, v) {
                                    l.addLayer(v);
                                });
                                GeoJsonAdded = true;
                            }
                            if (m.type === "Circle") {
                                g = L.circle(m._latlng, m._mRadius, m.style);
                                g.feature = m.feature;
                                l.addLayer(g);
                            }
                            if (m.type === "Rectangle") {
                                g = L.rectangle([m._latlngs[0], m._latlngs[2]], m.style);
                                g.feature = m.feature;
                                l.addLayer(g);
                            }
                            if (m.type === "Marker") {
                                g = L.marker(m._latlng, m.style);
                                g.feature = m.feature;
                                l.addLayer(g);
                            }
                        });
                    }

                    /**
                     * Recreate query buffer
                     */
                    if (response.data.queryBuffer !== null) {
                        GeoJsonAdded = false;
                        parr = response.data.queryBuffer;
                        v = parr;
                        l = advancedInfo.getDrawLayer();
                        $.each(v[0].geojson.features, function (n, m) {
                            if (m.type === "Feature" && GeoJsonAdded === false) {
                                var g = L.geoJson(v[0].geojson, {
                                    style: function (f) {
                                        return f.style;
                                    }
                                });
                                $.each(g._layers, function (i, v) {
                                    l.addLayer(v);
                                });
                                GeoJsonAdded = true;
                            }
                        });
                    }

                    /**
                     * Recreate result
                     */
                    if (response.data.queryResult !== null) {
                        GeoJsonAdded = false;
                        parr = response.data.queryResult;
                        v = parr;
                        $.each(v[0].geojson.features, function (n, m) {
                            if (m.type === "Feature" && GeoJsonAdded === false) {
                                var g = L.geoJson(v[0].geojson, {
                                    style: function (f) {
                                        return f.style;
                                    }
                                });
                                $.each(g._layers, function (i, v) {
                                    cloud.get().map.addLayer(v);
                                });
                                GeoJsonAdded = true;
                            }
                            if (m.type === "Circle") {
                                g = L.circleMarker(m._latlng, m.style);
                                g.setRadius(m._radius);
                                g.feature = m.feature;
                                cloud.get().map.addLayer(g);
                            }
                        });
                    }

                    // Recreate added layers
                    // from layerSearch
                    // =====================

                    var currentLayers = meta.getMetaData();
                    var flag;
                    var addedLayers = [];

                    // Get array with the added layers
                    $.each(response.data.metaData.data, function (i, v) {
                        flag = false;
                        $.each(currentLayers.data, function (u, m) {
                            if (m.f_table_name === v.f_table_name && m.f_table_schema === v.f_table_schema) {
                                flag = true; // Flag layers from loaded schemata
                            }
                        });
                        if (!flag) {
                            addedLayers.push(v);
                        }
                    });

                    // If any added layers, then add them
                    if (addedLayers.length > 0) {
                        meta.addMetaData({data: addedLayers});
                        layerTree.init();
                        if (arr) {
                            for (i = 0; i < arr.length; i++) {
                                switchLayer.init(arr[i], true, true);
                            }
                        }
                    }

                }
            });
        }
        backboneEvents.get().trigger("end:state");
    },
    setBaseLayer: function (b) {
        setBaseLayer = b;
    }
};