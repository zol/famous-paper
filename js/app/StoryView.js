define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    // var GenericSync         = require('famous-sync/GenericSync');
    // var Transitionable      = require('famous/Transitionable');
    // var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');

    var NameView            = require('./NameView');
    var TextView            = require('./TextView');
    var FooterView          = require('./FooterView');

    // Transitionable.registerMethod('spring', SpringTransition);

    function StoryView() {
        View.apply(this, arguments);

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        createCard.call(this);
        createProfilePic.call(this);
        createName.call(this);
        createText.call(this);
        createPhoto.call(this);
        createFooter.call(this);
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
            this.nameView = new NameView({
                name: this.options.name
            });
        }

        function createText() {
            if(!this.options.text) return;

            this.textView = new TextView({
                text: this.options.text,
                time: this.options.time,
                photos: !!this.options.photos
            });
        }

        function createPhoto() {
            var photos = this.options.photos;
            if(!photos) return;

            this.photoImg = new Image();
            this.photoImg.src = photos[0];
            this.photoImg.width = this.contentWidth;

            this.photo = new Surface({
                size: [this.contentWidth, this.contentWidth],
                content: this.photoImg,
                properties: {
                    boxShadow: '0 0 5px rgba(0,0,0,0.3)'
                }
            });
        }

        function createFooter() {
            this.footer = new FooterView({
                likes: this.options.likes,
                comments: this.options.comments
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
        time: null,
        likes: null,
        comments: null,

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
        var textPos = this.map(140, 105);
        var photoPos = this.map(-20, -68);
        var footerPos = this.map(48, 0);

        this.nameView.fade(this.progress);
        this.textView.fade(this.progress);


        this.spec = [];
        this.spec.push(this.card.render());

        this.spec.push({
            transform: FM.move(FM.scale(pPicScale, pPicScale, 1), [this.options.margin, this.options.margin, 0]),
            target: this.pPic.render()
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, namePos, 0),
            target: this.nameView.render()
        });

        if(this.textView) {
            this.spec.push({
                origin: [0.5, 0],
                transform: FM.translate(0, textPos, 0),
                size: [this.options.contentWidth, window.innerHeight - textPos - this.options.margin],
                target: {
                    target: this.textView.render()
                }
            });
        }

        if(this.photo) {
            this.spec.push({
                origin: [0.5, 1],
                transform: FM.translate(0, photoPos, 0.1),
                target: this.photo.render()
            });
        }

        this.spec.push({
            origin: [0.5, 1],
            transform: FM.translate(0, footerPos, 0),
            opacity: Easing.inOutQuadNorm.call(this, this.progress),
            target: this.footer.render()
        });

        this.spec.push({
            transform: FM.translate(0, 0, 2),
            target: this.cover.render()
        });

        return this.spec;
    };

    module.exports = StoryView;
});
