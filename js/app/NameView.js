define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');

    function NameView() {
        View.apply(this, arguments);

        createSmallName.call(this);
        createLargeName.call(this);
    }

    function createSmallName() {
        var name = this.options.name;

        this.smallName = new Surface({
            size: [this.options.width, window.innerHeight * this.options.height],
            content: '<span class="story-name">' + name + '</span>',
            properties: properties
        });

        this.smallMod = new Modifier({
            origin: [0.5, smallOrigin]
        });

        this._add(this.smallMod).link(this.smallName);
    }

    function createLargeName() {
        var name = this.options.name;

        this.largeName = new Surface({
            size: [this.options.width, window.innerHeight * this.options.height],
            content: '<span class="story-name">' + name + '</span><p class="story-time">' + this.options.time + '</p>',
            properties: properties
        });

        this.largeMod = new Modifier({
            origin: [0.5, largeOrigin]
        });

        this._add(this.largeMod).link(this.largeName);
    }

    NameView.prototype = Object.create(View.prototype);
    NameView.prototype.constructor = NameView;

    NameView.DEFAULT_OPTIONS = {
        width: 280,
        name: null,

        smallSmall: {
            fontSize: '21px',
            lineHeight: '25px'
        },

        smallMedium: {
            fontSize: '28px',
            lineHeight: '32px'
        },

        smallLarge: {
            fontSize: '31px',
            lineHeight: '35px'
        }
    };

    NameView.prototype.fade = function(progress) {
        this.smallMod.setOpacity(Easing.inOutQuadNorm.call(this, 1-progress));
        this.largeMod.setOpacity(Easing.inOutQuadNorm.call(this, progress));
    };

    module.exports = NameView;
});
