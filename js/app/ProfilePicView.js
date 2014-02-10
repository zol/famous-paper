define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');

    function ProfilePicView() {
        View.apply(this, arguments);

        this.profileImg = new Image();
        this.profileImg.src = this.options.profilePicUrl;
        this.profileImg.width = this.options.profilePicSize;

        var pic = new Surface({
            size: [120, 120],
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
        profilePicUrl: null,
        profilePicSize: null
    };

    ProfilePicView.prototype.scale = function(scale) {
        this.mod.setTransform(FM.scale(scale, scale, 1));
    };

    ProfilePicView.prototype.getSize = function() {
        return [this.options.width, this.options.height];
    };

    module.exports = ProfilePicView;
});
