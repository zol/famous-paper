define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var Utils               = require('famous-utils/Utils');

    function NumberView() {
        View.apply(this, arguments);

        createLowNum.call(this);
        createHighNum.call(this);
    }

    function createLowNum() {
        this.lowNum = new Surface({
            size: [this.options.size, this.options.size],
            content: '+' + (this.options.n-1),
            classes: ['number-view', 'profile-view']
        });

        this.lowMod = new Modifier();
        this._add(this.lowMod).link(this.lowNum);
    }

    function createHighNum() {
        this.highNum = new Surface({
            size: [this.options.size, this.options.size],
            content: '+' + this.options.n,
            classes: ['number-view', 'profile-view']
        });

        this.highMod = new Modifier();
        this._add(this.highMod).link(this.highNum);
    }

    NumberView.prototype = Object.create(View.prototype);
    NumberView.prototype.constructor = NumberView;

    NumberView.DEFAULT_OPTIONS = {
        n: null,
        size: 121
    };

    NumberView.prototype.fade = function(progress) {
        this.highMod.setOpacity(Easing.inOutQuadNorm.call(this, 1-progress));
        this.lowMod.setOpacity(Easing.inOutQuadNorm.call(this, progress));
    };

    NumberView.prototype.setScale = function(scale) {
        this.scale = scale;
        console.log(scale)
        this.lowMod.setTransform(FM.scale(scale, scale, 1));
        this.highMod.setTransform(FM.scale(scale, scale, 1));
    };

    NumberView.prototype.getSize = function() {
        return [this.options.size*this.scale, this.options.size*this.scale];
    };

    module.exports = NumberView;
});
