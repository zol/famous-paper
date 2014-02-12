define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ExpandingSurface    = require('surface-extensions/ExpandingSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var ContainerSurface    = require('famous/ContainerSurface');
    // var GenericSync         = require('famous-sync/GenericSync');
    // var Transitionable      = require('famous/Transitionable');
    // var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');
    var VideoSurface        = require('famous/VideoSurface');
    var EventHandler        = require('famous/EventHandler');

    var ArticleTopView      = require('./ArticleTopView');
    var ArticleBottomView   = require('./ArticleBottomView');
    var ArticleFullView     = require('./ArticleFullView');

    // Transitionable.registerMethod('spring', SpringTransition);

    function ArticleView() {
        View.apply(this, arguments);

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        createArticleTop.call(this);
        createArticleBottom.call(this);
        createArticleFull.call(this);
        createCover.call(this);

        function createArticleTop() {
            this.articleTop = new ArticleTopView({
                content: this.options.content
            });

            this.articleTop.setAngle(1);
        }

        function createArticleBottom() {
            this.articleBottom = new ArticleBottomView({
                content: this.options.content
            });

            this.articleBottom.setAngle(1);
            this.articleBottom.content.pipe(this.articleTop.scrollview);
        }

        function createArticleFull() {
            this.articleFull = new ArticleFullView({
                content: this.options.content
            });
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);

            this.cover.on('touchstart', function() {
                this.touch = true;
                // this.scrollview2.setVelocity(0);
            }.bind(this));

            this.cover.on('touchend', function() {
                this.touch = false;
            }.bind(this));

            // this.cover.pipe(this.articleTop.scrollview);
            // this.cover.pipe(this.articleBottom.scrollview);
        }
    }

    ArticleView.prototype = Object.create(View.prototype);
    ArticleView.prototype.constructor = ArticleView;

    ArticleView.DEFAULT_OPTIONS = {
        scale: null,
        content: null,
        thumbSm: null,
        thumbLg: null,

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
        this.cover.pipe(this.scrollview1);
        this.cover.pipe(this.scrollview2);
        this.enable = true;
    };

    ArticleView.prototype.disableScroll = function() {
        this.cover.unpipe(this.scrollview1);
        this.cover.unpipe(this.scrollview2);
        this.enable = false;
    };

    ArticleView.prototype.sequence = function() {
        console.log('sequence');
        this.scrollview2.setVelocity(0);
        this.scrollview2.setPosition(0);
        // this.scrollview2.sequenceFrom(this.firstNode);
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

        // this.mod0.setTransform(FM.translate(0, this.map(0, 0), 0.00001));
        // this.mod1.setTransform(FM.move(FM.rotateZ(this.map(-0.04, 0)), [this.map(-6, 0), this.map(-290, 0), 0]));

        this.articleBottom.scrollview.setPosition(this.articleTop.scrollview.getPosition());

        this.spec.push({
            target: this.articleFull.render()
        });

        this.spec.push({
            // target: this.articleTop.render()
        });

        this.spec.push({
            transform: FM.translate(0, window.innerHeight/2, 0),
            // target: this.articleBottom.render()
        });

        this.spec.push({
            transform: FM.translate(0, 0, 2),
            // target: this.cover.render()
        });

        return this.spec;
    };

    module.exports = ArticleView;
});
