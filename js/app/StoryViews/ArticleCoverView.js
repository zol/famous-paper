define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');

    function ArticleCoverView() {
        View.apply(this, arguments);
    }

    ArticleCoverView.prototype = Object.create(View.prototype);
    ArticleCoverView.prototype.constructor = ArticleCoverView;

    ArticleCoverView.DEFAULT_OPTIONS = {
        scale: null,
        thumbCoverSm: null,
        thumbCoverLg: null,
        content: null
    };

    module.exports = ArticleCoverView;
});