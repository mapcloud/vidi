/**
 * @fileoverview Description of file, its uses and information
 * about its dependencies.
 */

'use strict';

/**
 *
 * @returns {*}
 */
module.exports = function () {
    try {
        var max = $(document).height() - $('.tab-pane').offset().top - 70;
        return {
            max: max
        }
    } catch (e) {
        console.info(e.message);
        return 0;
    }
};