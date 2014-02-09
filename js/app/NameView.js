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
        this.smallName = new Surface({
            size: [this.options.width, 20],
            content: this.options.name,
            classes: ['story-name'],
            properties: {
                fontSize: '20px',
            }
        });

        this.smallMod = new Modifier();

        this._add(this.smallMod).link(this.smallName);
    }

    function createLargeName() {
        this.largeName = new Surface({
            size: [this.options.width, 20],
            content: this.options.name,
            classes: ['story-name'],
            properties: {
                fontSize: '15px',
            }
        });

        this.largeMod = new Modifier();

        this._add(this.largeMod).link(this.largeName);
    }

    NameView.prototype = Object.create(View.prototype);
    NameView.prototype.constructor = NameView;

    NameView.DEFAULT_OPTIONS = {
        width: 280,
        name: null
    };

    NameView.prototype.fade = function(progress) {
        this.smallMod.setOpacity(Easing.inOutQuadNorm.call(this, 1-progress));
        this.largeMod.setOpacity(Easing.inOutQuadNorm.call(this, progress));
    };

    module.exports = NameView;
});
