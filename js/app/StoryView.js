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

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        createCard.call(this);
        createProfilePic.call(this);
        createName.call(this);
        createText.call(this);
        createPhoto.call(this);
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
            this.profileImg = new Image();
            this.profileImg.src = this.options.profilePic;
            this.profileImg.width = this.options.profilePicSize;

            this.pPic = new Surface({
                size: [120, 120],
                content: this.profileImg,
                properties: {
                    border: '1px solid #ddd'
                }
            });
        }

        function createName() {
            this.nameLarge = new Surface({
                size: [this.contentWidth, 20],
                content: this.options.name,
                classes: ['story-name'],
                properties: {
                    fontSize: '15px',
                }
            });
        }

        function createText() {
            var text = this.options.text;
            if(!text) return;

            var fontSize;
            var properties;

            if(!this.options.photos) {
                if(text.length < 40) {
                    properties = {
                        fontSize: '28px',
                        lineHeight: '32px'
                    };

                    this.textOrigin = 0.5;
                } else if(text.length < 280) {
                    properties = {
                        fontSize: '20px',
                        lineHeight: '24px'
                    };

                    this.textOrigin = 0.5;
                } else {
                    properties = {
                        fontSize: '15px',
                        lineHeight: '19px'
                    };

                    this.textOrigin = 0;
                }

            } else {
                properties = {
                    fontSize: '15px',
                    lineHeight: '19px'
                };

                this.textOrigin = 0;
            }

            // text = text.replace(/(\#[a-zA-Z0-9\-]+)/g, '<span class="bold">$1</span>');
            this.textLarge = new Surface({
                size: [this.contentWidth, window.innerHeight * 0.2],
                content: text,
                properties: properties
            });
        }

        function createPhoto() {
            var photos = this.options.photos;
            if(!photos) return;

            this.photoImg = new Image();
            this.photoImg.src = photos[0];
            this.photoImg.width = this.contentWidth;

            this.photo = new Surface({
                size: [this.contentWidth+4, this.contentWidth+4],
                content: this.photoImg,
                properties: {
                    boxShadow: '0 0 5px rgba(0,0,0,0.3)'
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

        var namePos = this.map(120, 85);

        if(this.textOrigin) textPos = this.map(20, -15);
        else textPos = this.map(140, 105);

        this.spec = [];
        this.spec.push(this.card.render());

        this.spec.push({
            transform: FM.move(FM.scale(pPicScale, pPicScale, 1), [this.options.margin, this.options.margin, 0]),
            target: this.pPic.render()
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, namePos, 0),
            target: this.nameLarge.render()
        });

        if(this.options.text) {
            this.spec.push({
                origin: [0.5, this.textOrigin],
                transform: FM.translate(0, textPos, 0),
                target: this.textLarge.render()
            });
        }

        if(this.photo) {
            this.spec.push({
                origin: [0.5, 1],
                transform: FM.translate(0, -68, 0),
                target: this.photo.render()
            });
        }

        this.spec.push(this.cover.render());

        return this.spec;
    };

    module.exports = StoryView;
});