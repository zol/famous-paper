define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');

    function ProfilePicView() {
        View.apply(this, arguments);

        this.profileImg = new Image();
        this.profileImg.src = this.options.url;
        this.profileImg.width = this.options.size;

        var pic = new Surface({
            size: [this.options.size, this.options.size],
            content: this.profileImg,
            properties: {
                border: '1px solid #ddd'
            }
        });

        this.mod = new Modifier();
        this._link(this.mod).link(pic);
    }

    ProfilePicView.prototype = Object.create(View.prototype);
    ProfilePicView.prototype.constructor = ProfilePicView;

    ProfilePicView.DEFAULT_OPTIONS = {
        url: null,
        size: 120
    };

    ProfilePicView.prototype.setScale = function(scale) {
        this.scale = scale;
        this.mod.setTransform(FM.scale(scale, scale, 1));
    };

    ProfilePicView.prototype.getSize = function() {
        return [this.options.size*this.scale, this.options.size*this.scale];
    };

    module.exports = ProfilePicView;
});
