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
        createContent.call(this);
        createCover.call(this);

        function createCard() {
            this.card = new Surface({
                properties: {
                    borderRadius: '5px',
                    backgroundColor: 'white'
                }
            });
        }

        function createProfilePic() {
            var size = this.options.profilePicSize;

            this.pPic = new Surface({
                size: [120, 120],
                content: '<img width="' + size + '" src="' + this.options.profilePic + '" />',
                properties: {
                    border: '1px solid #ddd'
                }
            });
        }

        function createContent() {
            var text = this.options.text;
            var fontSize;
            
            if(text) {
                if(text.length < 20) {
                    fontSize = '26px';
                } else if(text.length < 80) {
                    fontSize = '20px';
                } else {
                    fontSize = '16px';
                }

                text = text.replace(/(\#[a-zA-Z0-9\-]+)/g, '<span class="bold">$1</span>');
            }

            this.smallText = new Surface({
                size: [window.innerWidth - 40, window.innerHeight * 0.2],
                content: text,
                properties: {
                    fontSize: fontSize,
                    lineHeight: '25px'
                }
            });
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);
        }
    }

    StoryView.prototype = Object.create(View.prototype);
    StoryView.prototype.constructor = StoryView;

    StoryView.DEFAULT_OPTIONS = {
        scale: null,
        name: null,
        profilePic: null,
        profilePicSize: 120,
        text: null,
        photos: null,

        margin: 20
    };

    StoryView.prototype.getSize = function() {
    };

    StoryView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    StoryView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    StoryView.prototype.render = function() {
        var pPicScale = this.map(1/3/this.options.scale, 0.5);
        var textPos = this.map(160, 120);

        this.spec = [];
        this.spec.push(this.card.render());

        this.spec.push({
            transform: FM.move(FM.scale(pPicScale, pPicScale, 1), [this.options.margin, this.options.margin, 0]),
            target: this.pPic.render()
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, textPos, 0),
            target: this.smallText.render()
        })

        this.spec.push(this.cover.render());
        return this.spec;
    };

    module.exports = StoryView;
});