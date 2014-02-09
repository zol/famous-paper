define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');

    function TextView() {
        View.apply(this, arguments);

        // createSmallText.call(this);
        createLargeText.call(this);
    }

    function createSmallText() {
        var text = this.options.text;

        if(!this.options.photos) {
            if(text.length < 40) {
                properties = {
                    fontSize: '28px',
                    lineHeight: '32px'
                };

                smallOrigin = 0.5;
            } else if(text.length < 280) {
                properties = {
                    fontSize: '20px',
                    lineHeight: '24px'
                };

                smallOrigin = 0.5;
            } else {
                properties = {
                    fontSize: '15px',
                    lineHeight: '19px'
                };

                smallOrigin = 0;
            }

        } else {
            properties = {
                fontSize: '15px',
                lineHeight: '19px'
            };

            smallOrigin = 0;
        }

        this.smallText = new Surface({
            size: [this.options.width, window.innerHeight * this.options.height],
            content: '<span class="story-text">' + text + '</span><p class="story-time">' + this.options.time + '</p>',
            properties: properties
        });

        this.smallMod = new Modifier({
            origin: [0.5, smallOrigin]
        });

        this._add(this.smallMod).link(this.smallText);
    }

    function createLargeText() {
        var text = this.options.text;

        if(!this.options.photos) {
            if(text.length < 40) {
                properties = {
                    fontSize: '28px',
                    lineHeight: '32px'
                };

                largeOrigin = 0.5;
            } else if(text.length < 280) {
                properties = {
                    fontSize: '20px',
                    lineHeight: '24px'
                };

                largeOrigin = 0.4;
            } else {
                properties = {
                    fontSize: '15px',
                    lineHeight: '19px'
                };

                largeOrigin = 0;
            }

        } else {
            properties = {
                fontSize: '15px',
                lineHeight: '19px'
            };

            largeOrigin = 0;
        }

        // text = text.replace(/(\#[a-zA-Z0-9\-]+)/g, '<span class="bold">$1</span>');
        this.largeText = new Surface({
            size: [this.options.width, window.innerHeight * this.options.height],
            content: '<span class="story-text">' + text + '</span><p class="story-time">' + this.options.time + '</p>',
            properties: properties
        });

        this.largeMod = new Modifier({
            origin: [0.5, largeOrigin]
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
        photos: null
    };

    module.exports = TextView;
});
