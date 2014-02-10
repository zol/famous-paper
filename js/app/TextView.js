define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');

    function TextView() {
        View.apply(this, arguments);

        createSmallText.call(this);
        createLargeText.call(this);
    }

    function createSmallText() {
        var text = this.options.text;

        if(!this.options.photos) {
            if(text.length < 40) {
                properties = this.options.smallLarge;
                smallOrigin = this.options.originLg;
            } else if(text.length < 280) {
                properties = this.options.smallMedium;
                smallOrigin = this.options.originMed;
            } else {
                properties = this.options.smallSmall;
                smallOrigin = this.options.originSm;
            }
        } else {
            properties = this.options.smallSmall;

            smallOrigin = this.options.originSm;
        }

        this.smallText = new Surface({
            size: [this.options.width, window.innerHeight * this.options.height],
            content: '<span class="story-text">' + text + '</span>',
            properties: properties
        });

        this.smallMod = new Modifier({
            origin: [0, smallOrigin]
        });

        this._add(this.smallMod).link(this.smallText);
    }

    function createLargeText() {
        var text = this.options.text;

        if(!this.options.photos) {
            if(text.length < 40) {
                properties = this.options.largeLarge;
                largeOrigin = this.options.originLg;
            } else if(text.length < 280) {
                properties = this.options.largeMedium;
                largeOrigin = this.options.originMed;
            } else {
                properties = this.options.largeSmall;
                largeOrigin = this.options.originSm;
            }

        } else {
            properties = this.options.largeSmall;
            largeOrigin = this.options.originSm;
        }

        // text = text.replace(/(\#[a-zA-Z0-9\-]+)/g, '<span class="bold">$1</span>');
        this.largeText = new Surface({
            size: [this.options.width, window.innerHeight * this.options.height],
            content: '<span class="story-text">' + text + '</span><p class="story-time">' + this.options.time + '</p>',
            properties: properties
        });

        this.largeMod = new Modifier({
            origin: [0, largeOrigin]
        });

        this._add(this.largeMod).link(this.largeText);
    }

    TextView.prototype = Object.create(View.prototype);
    TextView.prototype.constructor = TextView;

    TextView.DEFAULT_OPTIONS = {
        width: 280,
        height: 0.3,
        text: null,
        time: null,
        photos: null,

        smallLarge: {
            fontSize: '31px',
            lineHeight: '35px'
        },
        smallMedium: {
            fontSize: '28px',
            lineHeight: '32px'
        },
        smallSmall: {
            fontSize: '21px',
            lineHeight: '25px'
        },

        largeLarge: {
            fontSize: '28px',
            lineHeight: '32px'
        },
        largeMedium: {
            fontSize: '20px',
            lineHeight: '24px'
        },
        largeSmall: {
            fontSize: '15px',
            lineHeight: '19px'
        },

        originLg: 0.45,
        originMed: 0.35,
        originSm: 0.01
    };

    TextView.prototype.fade = function(progress) {
        this.smallMod.setOpacity(Easing.inOutQuadNorm.call(this, 1-progress));
        this.largeMod.setOpacity(Easing.inOutQuadNorm.call(this, progress));
    };

    TextView.prototype.getSize = function() {
        return [280, 60];
    };

    module.exports = TextView;
});
