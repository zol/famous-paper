define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ExpandingSurface    = require('surface-extensions/ExpandingSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
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

    var ProfilePicsView     = require('./ProfilePicsView');
    var NameView            = require('./NameView');
    var TextView            = require('./TextView');
    var FooterView          = require('./FooterView');

    // Transitionable.registerMethod('spring', SpringTransition);

    function ArticleView() {
        View.apply(this, arguments);

        // this.contentWidth = window.innerWidth - 2*this.options.margin;

        this.scrollable = true;
        // this.content = [];

        createCard.call(this);
        // createProfilePic.call(this);
        // createName.call(this);
        // createText.call(this);
        // createPhotos.call(this);
        // createFooter.call(this);
        createScrollview.call(this);
        createCover.call(this);

        function createCard() {
            this.card = new Surface({
                properties: {
                    borderRadius: '5px',
                    backgroundColor: 'white'
                }
            });

            this.card.pipe(this.eventOutput);
        }

        function createProfilePic() {
            this.content.push(new Surface({
                size: [undefined, this.options.margin]
            }));

            this.profilePicsView = new ProfilePicsView({
                scale: this.options.scale,
                urls: this.options.profilePics
            });

            this.content.push(this.profilePicsView);

            var node = new RenderNode();
            node.getSize = function() {
                return [undefined, this.map(2, 1) * 5];
            }.bind(this);

            this.content.push(node);
        }

        function createName() {
            this.nameView = new NameView({
                name: this.options.name
            });

            this.content.push(this.nameView);
        }

        function createText() {
            if(!this.options.text) return;

            this.textView = new TextView({
                text: this.options.text,
                time: this.options.time,
                photos: !!this.options.photos
            });

            this.content.push(this.textView);
        }

        function createPhotos() {
            for(var i = 0; i < this.options.photos.length; i++) {
                this.photoImg = new Image();
                this.photoImg.src = this.options.photos[i];
                this.photoImg.width = this.contentWidth;

                var surface = new Surface({
                    size: [this.contentWidth, this.contentWidth],
                    content: this.photoImg,
                    properties: {
                        boxShadow: '0 0 5px rgba(0,0,0,0.3)'
                    }
                });

                if(i < 2) {
                    var node = new RenderNode();
                    var mod = this['mod' + i] = new Modifier();
                    node.link(mod).link(surface);
                    this.content.push(node);

                    node.getSize = function() {
                        return [280, 280];
                    };
                } else {
                    this.content.push(surface);
                }

                this.content.push(new Surface({
                    size: [undefined, 15]
                }));
            }
        }

        function createFooter() {
            this.footer = new FooterView({
                likes: this.options.likes,
                comments: this.options.comments
            });

            this.content.push(this.footer);
        }

        function createScrollview () {
            this.scrollview = new Scrollview({
                itemSpacing: 0,
                clipSize: undefined,
                margin: window.innerHeight,
                drag: 0.001,
                edgeGrip: 1,
                edgePeriod: 300,
                // edgeDamp: 1,
                // paginated: false,
                // pagePeriod: 500,
                // pageDamp: 0.8,
                // pageStopSpeed: Infinity,
                // pageSwitchSpeed: 1,
                speedLimit: 10
            });

            var content = new ExpandingSurface({
                size: [280, undefined],
                classes: ['article'],
                content: this.options.content
            });

            content.getSize = function() {
                return [280, 800]
            }

            this.scrollview.sequenceFrom(content);
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);

            this.cover.on('touchstart', function() {
                this.touch = true;
                this.scrollview.setVelocity(0);
            }.bind(this));

            this.cover.on('touchend', function() {
                this.touch = false;
            }.bind(this));

        }
    }

    ArticleView.prototype = Object.create(View.prototype);
    ArticleView.prototype.constructor = ArticleView;

    ArticleView.DEFAULT_OPTIONS = {
        scale: null,
        name: null,
        profilePics: null,
        text: null,
        content: null,
        thumbSm: null,
        thumbLg: null,
        time: null,
        likes: null,
        comments: null,

        margin: 20
    };

    ArticleView.prototype.getSize = function() {
    };

    ArticleView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    ArticleView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    ArticleView.prototype.enableScroll = function() {
        this.cover.pipe(this.scrollview);
        this.enable = true;
    };

    ArticleView.prototype.disableScroll = function() {
        this.cover.unpipe(this.scrollview);
        this.enable = false;
    };

    ArticleView.prototype.sequence = function() {
        console.log('sequence');
        this.scrollview.setVelocity(0);
        this.scrollview.setPosition(0);
        // this.scrollview.sequenceFrom(this.firstNode);
    };

    ArticleView.prototype.render = function() {
        // var namePos = this.map(120, 85);
        // var textPos = this.map(140, 105);
        // var photoPos = this.map(-20, -68);
        // var footerPos = this.map(48, 0);

        // this.profilePicsView.setProgress(this.progress);
        // this.nameView.setProgress(this.progress);
        // this.nameView.fade(this.progress);
        // this.textView.fade(this.progress);

        this.spec = [];
        this.spec.push(this.card.render());

        var scrollPos = this.scrollview.getPosition();
        if(scrollPos < 10) {
            this.top = true;
        } else {
            this.top = false;
        }

        // this.mod0.setTransform(FM.translate(0, this.map(0, 0), 0.00001));
        // this.mod1.setTransform(FM.move(FM.rotateZ(this.map(-0.04, 0)), [this.map(-6, 0), this.map(-290, 0), 0]));

        this.spec.push({
            transform: FM.translate(20, 0, 0),
            target: this.scrollview.render()
        });

        this.spec.push({
            transform: FM.translate(0, 0, 2),
            target: this.cover.render()
        });

        return this.spec;
    };

    module.exports = ArticleView;
});
