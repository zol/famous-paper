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
    var Utils               = require('famous-utils/Utils');

    // Transitionable.registerMethod('spring', SpringTransition);

    function StoryView() {
        View.apply(this, arguments);

        createCard.call(this);
        createProfilePic.call(this);

        function createCard() {
            this.card = new Surface({
                size: [undefined, undefined],
                properties: {
                    borderRadius: '5px',
                    backgroundColor: 'white'
                }
            });

            this.card.pipe(this.eventOutput);
        }

        function createProfilePic() {
            var size = this.options.profilePicSize;

            this.pPic = new Surface({
                size: [120, 120],
                content: '<img width="' + size + '" src="' + this.options.profilePic + '" />',
                properties: {
                    backgroundColor: 'blue'
                }
            });

            this.pPic.pipe(this.eventOutput);
        };
    }

    StoryView.prototype = Object.create(View.prototype);
    StoryView.prototype.constructor = StoryView;

    StoryView.DEFAULT_OPTIONS = {
        name: null,
        profilePic: null,
        profilePicSize: 120,
        scale: null
    };

    StoryView.prototype.getSize = function() {
    };

    StoryView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    StoryView.prototype.render = function() {
        this.spec = [];
        this.spec.push({
            target: this.card.render()
        });

        this.spec.push({
            transform: FM.move(FM.scale(1, 1, 1), [15, 15, 0]),
            target: this.pPic.render()
        });

        return this.spec;
    };

    module.exports = StoryView;
});