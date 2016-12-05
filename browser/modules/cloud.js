/**
 * @fileoverview Description of file, its uses and information
 * about its dependencies.
 */

'use strict';

try {
    geocloud.setHost(require('../../config/config.js').gc2.host);
} catch (e){
    console.info(e.message);
}

/**
 *
 * @type {geocloud.map}
 */
var cloud = new geocloud.map({
    el: "map",
    zoomControl: false,
    numZoomLevels: 21,
    editable: true
});

/**
 *
 */
var zoomControl = L.control.zoom({
    position: 'topright'
});
cloud.map.addControl(zoomControl);
var map = cloud.map;


/*var scaleControl = L.control.scale({position: "bottomright"});
 cloud.map.addControl(scaleControl);*/

/**
 *
 */
/*var lc = L.control.locate({
    position: 'topright',
    strings: {
        title: "Find me"
    },
    icon: "fa fa-location-arrow",
    iconLoading: "fa fa-circle-o-notch fa-spin"
}).addTo(map);*/



var localization;
if (window._vidiLocale === "da_DK") {
    localization = "da";
}
if (window._vidiLocale === "en_US") {
    localization = "en";
}
/**
 *
 */
var measureControl = new L.Control.Measure({
    position: 'topright',
    primaryLengthUnit: 'kilometers',
    secondaryLengthUnit: 'meters',
    primaryAreaUnit: 'hectares',
    secondaryAreaUnit: 'sqmeters',
    localization: localization

});
measureControl.addTo(map);
module.exports = cloud;