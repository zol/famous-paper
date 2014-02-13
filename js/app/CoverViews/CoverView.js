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
        this.profileImg.style.webkitBoxReflect = 'below';

        var bg = new Surface({
            content: '<img width="320" src="./img/covers/bg.png" />'
        });

        var mod = new Modifier({
            transform: FM.translate(0, 0, 0.001)
        });

        var pic = new Surface({
            size: [this.options.size, this.options.size],
            content: this.profileImg
        });

        this._add(mod).link(bg);
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
