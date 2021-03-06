/**
 * @fileoverview Description of file, its uses and information
 * about its dependencies.
 */

'use strict';

/**
 *
 * @type {*|exports|module.exports}
 */
var urlparser = require('./urlparser');

/**
 * @type {string}
 */
var db = urlparser.db;


/**
 * @type {Object}
 */
var cloud;

/**
 *
 * @type {boolean}
 */
var ready = false;

/**
 *
 * @type {boolean}
 */
var cartoDbLayersready = false;

/**
 *
 * @type {string}
 */
var BACKEND = require('../../config/config.js').backend;


/**
 * @type {string}
 */
var host;

/**
 *
 */
var meta;

/**
 *
 */
var backboneEvents;

var countLoaded = 0;

var mustache = require('mustache');

try {
    host = require('../../config/config.js').gc2.host;
    // Strip protocol
    //host = host.replace("https:","").replace("http:","");
} catch (e) {
    console.info(e.message);
}

var switchLayer;

var singleTiled = require('../../config/config.js').singleTiled || [];

/**
 *
 * @type {{set: module.exports.set, init: module.exports.init, getMetaDataKeys: module.exports.getMetaDataKeys, ready: module.exports.ready}}
 */
module.exports = {
    /**
     *
     * @param o
     * @returns {exports}
     */
    set: function (o) {
        cloud = o.cloud;
        meta = o.meta;
        backboneEvents = o.backboneEvents;
        switchLayer = o.switchLayer;
        return this;
    },

    /**
     *
     */
    init: function () {

    },

    ready: function () {
        // If CartoDB, we wait for cartodb.createLayer to finish
        if (BACKEND === "cartodb") {
            return (ready && cartoDbLayersready);
        }
        // GC2 layers are direct tile request
        else {
            return ready;
        }
    },

    getLayers: function (separator, includeHidden) {
        var layerArr = [];
        var layers = cloud.get().map._layers;
        for (var key in layers) {
            if (layers.hasOwnProperty(key)) {
                if (layers[key].baseLayer !== true && typeof layers[key]._tiles === "object") {
                    if (typeof layers[key].id === "undefined" || (typeof layers[key].id !== "undefined" && (layers[key].id.split(".")[0] !== "__hidden") || includeHidden === true)) {
                        layerArr.push(layers[key].id);
                    }
                }
            }
        }
        if (layerArr.length > 0) {
            return layerArr.join(separator ? separator : ",");
        }
        else {
            return false;
        }
    },

    removeHidden: function () {
        var layers = cloud.get().map._layers;
        for (var key in layers) {
            if (layers.hasOwnProperty(key)) {
                if (typeof layers[key].id !== "undefined" && layers[key].id.split(".")[0] === "__hidden") {
                    cloud.get().map.removeLayer(layers[key]);
                }
            }
        }
    },
    resetCount: function () {
        ready = cartoDbLayersready = false;
        countLoaded = 0;
    },

    incrementCount: function () {
        countLoaded++;
        return countLoaded
    },

    /**
     *
     * @param l
     * @returns {Promise}
     */
    addLayer: function (l) {
        return new Promise(function (resolve, reject) {

            var isBaseLayer, layers = [], metaData = meta.getMetaData();

            $.each(metaData.data, function (i, v) {

                var layer = v.f_table_schema + "." + v.f_table_name;

                if (layer === l) {

                    switch (BACKEND) {

                        case "gc2":

                            isBaseLayer = v.baselayer ? true : false;

                            layers[[layer]] = cloud.get().addTileLayers({
                                host: host,
                                layers: [layer],
                                db: db,
                                isBaseLayer: isBaseLayer,
                                tileCached: singleTiled.indexOf(layer) === -1,
                                visibility: false,
                                wrapDateLine: false,
                                displayInLayerSwitcher: true,
                                name: v.f_table_name,
                                // Single tile option
                                type: singleTiled.indexOf(layer) === -1 ? "tms" : "wms",
                                tileSize: singleTiled.indexOf(layer) === -1 ? 256 : 9999,
                                format: "image/png",
                                loadEvent: function () {
                                    countLoaded++;
                                    backboneEvents.get().trigger("doneLoading:layers", countLoaded);
                                },
                                subdomains: window.gc2Options.subDomainsForTiles
                            });

                            layers[[layer]][0].setZIndex(v.sort_id + 10000);

                            resolve();

                            break;

                        case "cartodb":

                            var tooltipHtml;

                            var fieldconf = JSON.parse(v.fieldconf), interactivity = ["cartodb_id"], template;

                            template = (typeof v.tooltip !== "undefined" && v.tooltip.template !== "" ) ? v.tooltip.template : null;

                            $.each(fieldconf, function (name, property) {
                                if (typeof property.utfgrid !== "undefined" && property.utfgrid === true) {
                                    interactivity.push(name)
                                }
                            });

                            cartodb.createLayer(cloud.get().map, {
                                user_name: db,
                                type: 'cartodb',
                                sublayers: [{
                                    sql: v.sql,
                                    cartocss: v.cartocss,
                                    interactivity: interactivity.join(",")
                                }]
                            })
                                .on('done', function (cartoLayer) {

                                    cartoLayer.baseLayer = false;
                                    cartoLayer.id = v.f_table_schema + "." + v.f_table_name;
                                    cartoLayer.on("load", function () {
                                        console.log("Layer loaded");
                                        countLoaded++;
                                        backboneEvents.get().trigger("doneLoading:layers", countLoaded);
                                    });
                                    cloud.get().addLayer(cartoLayer, v.f_table_name);

                                    // We switch the layer on/off, so they become ready for state.
                                    cloud.get().showLayer(cartoLayer.id);
                                    cloud.get().hideLayer(cartoLayer.id);

                                    resolve();


                                    // Carto layer object is not complete(!?), so we poll until _url prop is set
                                    if (interactivity.length > 0) {
                                        (function poll1() {
                                            if (typeof cartoLayer._url !== "undefined") {

                                                // A bit hackery way to set UTFgrid url
                                                var utfGrid = new L.UtfGrid(cartoLayer._url.replace(".png", "") + '.grid.json?callback={cb}&interactivity=name'), flag = false;
                                                utfGrid.id = cartoLayer.id + "_vidi_utfgrid";
                                                cloud.get().addLayer(utfGrid);
                                                utfGrid.on('mouseover', _.debounce(function (e) {
                                                    var tmp = $.extend(true, {}, e.data), fi = [];
                                                    flag = true;
                                                    $.each(tmp, function (name, property) {
                                                        if (name !== "cartodb_id") {
                                                            fi.push({
                                                                title: fieldconf[name].alias_tooltip || name,
                                                                value: property
                                                            });
                                                        }
                                                    });
                                                    tmp.fields = fi; // Used in a "loop" template
                                                    tooltipHtml = Mustache.render(template, tmp);
                                                    if (fi.length > 0) {
                                                        $("#tail").fadeIn(100);
                                                        $("#tail").html(tooltipHtml);
                                                    }

                                                }, 0));
                                                utfGrid.on('mouseout', function (e) {
                                                    flag = false;
                                                    // Wait 200 ms before closing tooltip, so its not blinking between close features
                                                    setTimeout(function () {
                                                        if (!flag) {
                                                            $("#tail").fadeOut(100);
                                                        }
                                                    }, 200)

                                                });
                                                cartoDbLayersready = true;
                                                backboneEvents.get().trigger("ready:layers");
                                            } else {
                                                setTimeout(function () {
                                                    poll1()
                                                }, 50);
                                            }
                                        }());
                                    }

                                });
                            break;
                    }
                }
            });

            console.info(l + " added to the map.");
        })
    }
};