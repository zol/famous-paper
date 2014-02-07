define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    // var Easing              = require('famous-animation/Easing');
    // var GenericSync         = require('famous-sync/GenericSync');
    // var Transitionable      = require('famous/Transitionable');
    // var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');

    // Transitionable.registerMethod('spring', SpringTransition);

    function StoryView() {
        View.apply(this, arguments);

        createCard.call(this);
        createProfilePic.call(this);

        function createCard() {
            var surface = new Surface({
                size: [this.options.cardWidth, this.options.cardHeight],
                properties: {
                    borderRadius: '2px',
                    backgroundColor: 'white'
                }
            });

            var modifier = new Modifier();

            this._add(modifier).link(surface);
            surface.pipe(this.eventOutput);
        }

        function createProfilePic() {
            var size = this.options.profilePicSize;

            var surface = new Surface({
                size: [size, size],
                content: '<img width="' + size + '" src="' + this.options.profilePic + '" />',
                properties: {
                    backgroundColor: 'blue'
                }
            });

            var modifier = new Modifier({
                transform: FM.translate(8, 8, 0)
            });

            this._add(modifier).link(surface);
            surface.pipe(this.eventOutput);
        };
    }

    StoryView.prototype = Object.create(View.prototype);
    StoryView.prototype.constructor = StoryView;

    StoryView.DEFAULT_OPTIONS = {
        name: null,
        profilePic: null,
        profilePicSize: 40,
        cardWidth: null,
        cardHeight: null
    };

    StoryView.prototype.getSize = function() {
        return [this.options.cardWidth, this.options.cardHeight];
    };

    // StoryView.prototype.render = function() {
    //     this.spec = [];

    //     return this.spec;
    // };

    module.exports = StoryView;
});