define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var GenericSync         = require('famous-sync/GenericSync');
    var Transitionable      = require('famous/Transitionable');
    var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');

    var ProfilePicsView     = require('./ProfilePicsView');
    var NameView            = require('./NameView');
    var TextView            = require('./TextView');
    var ArticleView         = require('../ArticleViews/ArticleView');
    var FooterView          = require('./FooterView');

    Transitionable.registerMethod('spring', SpringTransition);

    function ArticleStoryView() {
        View.apply(this, arguments);

        this.flipable = true;
        this.closed = true;

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        createSync.call(this);
        createCard.call(this);
        createProfilePic.call(this);
        createName.call(this);
        createText.call(this);
        createArticle.call(this);
        createFooter.call(this);
        createCover.call(this);

        function createSync() {
            this.pos = new Transitionable(0);

            this.sync = new GenericSync(function() {
                return this.pos.get();
            }.bind(this), {direction: Utility.Direction.Y});

            this.sync.on('update', function(data) {
                if(this.progress !== 1) return;

                if(this.open && this.article.atTop && data.v > 0) {
                    this.articleScale.set(0.875, this.options.curve);
                    this.articleTop.set(-68, this.options.curve);
                }

                if(this.article.atTop && data.v > 0) { // closing top
                    this.article.disableScroll();
                    this.open = false;
                }

                if(!this.open) {
                    this.pos.set(data.p);
                }
            }.bind(this));

            this.sync.on('end', function() {
                if(this.angle < Math.PI/2) {
                    this.pos.set(-320, this.options.curve);
                    this.articleScale.set(1, this.options.curve);
                    this.articleTop.set(0, this.options.curve);
                    this.closed = false;
                    this.open = true;
                    this.article.enableScroll();
                    this.article.enable = true;
                } else {
                    this.articleScale.set(0.875, this.options.curve);
                    this.articleTop.set(-68, this.options.curve);
                    this.pos.set(0, this.options.curve, function() {
                        this.article.enable = false;
                        this.closed = true;
                    }.bind(this));
                }
            }.bind(this));
        }

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
            this.profilePicsView = new ProfilePicsView({
                scale: this.options.scale,
                urls: this.options.profilePics
            });

            this.profilePicsView.pipe(this.eventOutput);
        }

        function createName() {
            this.nameView = new NameView({
                name: this.options.name
            });

            this.nameView.pipe(this.eventOutput);
        }

        function createText() {
            if(!this.options.text) return;

            this.textView = new TextView({
                text: this.options.text,
                time: this.options.time,
                photos: true
            });

            this.textView.pipe(this.eventOutput);
        }

        function createArticle() {
            this.article = new ArticleView({
                scale: this.options.scale,
                content: this.options.content,
                thumbSm: this.options.thumbSm,
                thumbLg: this.options.thumbLg,
            });

            this.article.pipe(this.eventOutput);
            // this.article.pipe(this.sync);

            this.articleScale = new Transitionable(0.875);
            this.articleTop = new Transitionable(-68);
        }

        function createFooter() {
            this.footer = new FooterView({
                likes: this.options.likes,
                comments: this.options.comments
            });

            this.footer.pipe(this.eventOutput);
        }

        function createCover() {
            this.cover = new Surface({
                properties: {
                    backgroundColor: 'blue'
                }
            });

            this.cover.pipe(this.eventOutput);
        }
    }

    ArticleStoryView.prototype = Object.create(View.prototype);
    ArticleStoryView.prototype.constructor = ArticleStoryView;

    ArticleStoryView.DEFAULT_OPTIONS = {
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

        margin: 20,

        curve: {
            duration: 200,
            curve: 'easeInOut'
        }
    };

    ArticleStoryView.prototype.getSize = function() {
    };

    ArticleStoryView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    ArticleStoryView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    ArticleStoryView.prototype.enableFlip = function() {
        // this.enable = true;
        this.article.pipe(this.sync);
    };

    ArticleStoryView.prototype.disableFlip = function() {
        // this.enable = false;
        this.article.unpipe(this.sync);
    };

    ArticleStoryView.prototype.render = function() {
        var pos = this.pos.get();

        this.angle = Utils.map(pos, 0, -320, Math.PI, 0, true);
        this.article.setAngle(this.angle);

        var articleScale = this.articleScale.get();

        // this.stopped = Math.abs(this.article.articleFull.scrollview.getVelocity()) < 0.01;

        var namePos = this.map(120, 85);
        var textPos = this.map(140, 105);
        var photoPos = this.map(-20, this.articleTop.get());
        var footerPos = this.map(48, 0);
        var profilePicScale = this.map(1/3/this.options.scale, 0.5);

        this.profilePicsView.setProgress(this.progress);
        this.nameView.fade(this.progress);
        this.textView.fade(this.progress);

        this.open = this.angle === 0;

        if(this.open) {
            this.article.articleBottom.noShadow();
        } else {
            this.article.articleBottom.shadow();
        }

        this.spec = [];
        this.spec.push(this.card.render());

        this.spec.push({
            transform: FM.translate(this.options.margin, this.options.margin, 0),
            target: this.profilePicsView.render()
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, namePos, 0),
            target: this.nameView.render()
        });

        if(this.textView) {
            this.spec.push({
                transform: FM.translate(this.options.margin, textPos, 0),
                size: [this.options.contentWidth, window.innerHeight - textPos - this.options.margin],
                target: {
                    target: this.textView.render()
                }
            });
        }

        this.spec.push({
            origin: [0.5, 0],
            transform: FM.move(FM.scale(articleScale, articleScale, 1), [0, photoPos, 0.0001]),
            size: [window.innerWidth, window.innerHeight],
            target: {
                target: this.article.render()
            }
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, window.innerHeight - this.footer.getSize()[1], 0),
            opacity: Easing.inOutQuadNorm.call(this, this.progress),
            target: this.footer.render()
        });

        // if(!this.enable) {
        //     this.spec.push({
        //         transform: FM.translate(0, 0, 1000),
        //         // target: this.cover.render()
        //     });
        // }

        return this.spec;
    };

    module.exports = ArticleStoryView;
});
