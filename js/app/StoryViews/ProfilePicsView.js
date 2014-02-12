define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var Utils               = require('famous-utils/Utils');

    var ProfilePicView      = require('./ProfilePicView');
    var NumberView          = require('./NumberView');

    function ProfilePicsView() {
        View.apply(this, arguments);

        this.mods = [];
        this.picViews = [];

        for(var i = 0; i < Math.min(this.options.urls.length, 3); i++) {
            var view = new ProfilePicView({
                url: this.options.urls[i]
            });

            var mod = new Modifier();

            this.mods.push(mod);
            this.picViews.push(view);

            this._add(mod).link(view);

            view.pipe(this.eventOutput);
        }

        if(this.options.urls.length > 3) {
            this.numView = new NumberView({
                n: this.options.urls.length - 2
            });

            this.numMod = new Modifier();

            this._add(this.numMod).link(this.numView);
        }
    }

    ProfilePicsView.prototype = Object.create(View.prototype);
    ProfilePicsView.prototype.constructor = ProfilePicsView;

    ProfilePicsView.DEFAULT_OPTIONS = {
        scale: null,
        urls: null,
        spacing: 5,
        size: 120
    };

    ProfilePicsView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    ProfilePicsView.prototype.setProgress = function(progress) {
        this.progress = progress;

        this.scale = this.map(1/3/this.options.scale, 0.5);

        for(var i = 0; i < this.mods.length; i++) {
            this.picViews[i].setScale(this.scale);
            this.mods[i].setTransform(FM.translate((this.options.size*this.scale + this.options.spacing)*i, 0, 0));
        }

        if(this.options.urls.length > 3) {
            this.mods[2].setOpacity(Easing.outQuadNorm.call(this, progress));
            this.mods[2].setTransform(FM.move(FM.scale(this.progress, 1, 1), [(this.options.size*this.scale + this.options.spacing)*2, 0, 0]));

            this.numView.setScale(this.scale);
            this.numView.fade(this.progress);
            this.numMod.setTransform(FM.translate((this.options.size*this.scale + this.options.spacing)*(2+this.progress), 0, 0));
        }
    };

    ProfilePicsView.prototype.getSize = function() {
        return [undefined, this.options.size*this.scale];
    };

    module.exports = ProfilePicsView;
});
