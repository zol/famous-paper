define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');

    function CoverView() {
        View.apply(this, arguments);

        this.profileImg = new Image();
        this.profileImg.src = this.options.img;
        this.profileImg.width = 320;

        var pic = new Surface({
            size: [this.options.size, this.options.size],
            content: this.profileImg
        });

        this._add(pic);
    }

    CoverView.prototype = Object.create(View.prototype);
    CoverView.prototype.constructor = CoverView;

    CoverView.DEFAULT_OPTIONS = {
        text: null,
        name: null,
        img: null
    };

    module.exports = CoverView;
});
