define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var ExpandingSurface    = require('surface-extensions/ExpandingSurface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var Utils               = require('famous-utils/Utils');

    function NameView() {
        View.apply(this, arguments);

        createSmallName.call(this);
        createLargeName.call(this);
    }

    function createSmallName() {
        this.smallName = new ExpandingSurface({
            size: [this.options.width, undefined],
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
        this.largeName = new ExpandingSurface({
            size: [this.options.width, undefined],
            content: '<div>' + this.options.name + '</div>',
            classes: ['story-name'],
            properties: {
                fontSize: '15px',
                // backgroundColor: 'blue'
            }
        });

        this.largeMod = new Modifier({
            transform: FM.translate(0, 2, 0)
        });

        this._add(this.largeMod).link(this.largeName);
    }

    NameView.prototype = Object.create(View.prototype);
    NameView.prototype.constructor = NameView;

    NameView.DEFAULT_OPTIONS = {
        width: 280,
        height: 15,
        name: null
    };

    NameView.prototype.fade = function(progress) {
        this.smallMod.setOpacity(Easing.inOutQuadNorm.call(this, 1-progress));
        this.largeMod.setOpacity(Easing.inOutQuadNorm.call(this, progress));
    };

    NameView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    NameView.prototype.getSize = function() {
        return [this.options.width, Utils.map(this.progress, 0, 1, this.smallName.getSize()[1], this.largeName.getSize()[1])-2];
    };

    NameView.prototype.getLargeSize = function() {
        debugger
        console.log([this.options.width, this.largeName.getSize()[1]])
        return [this.options.width, this.largeName.getSize()[1]];
    };

    module.exports = NameView;
});
