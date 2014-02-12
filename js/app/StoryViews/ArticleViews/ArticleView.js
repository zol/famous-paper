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
    var Transitionable      = require('famous/Transitionable');
    // var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');
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
            this.articleTop = new ArticleTopView(this.options);

            this.articleTop.pipe(this.eventOutput);
        }

        function createArticleBottom() {
            this.articleBottom = new ArticleBottomView(this.options);

            this.articleBottom.pipe(this.eventOutput);
            this.articleBottom.content.pipe(this.articleTop.scrollview);
        }

        function createArticleFull() {
            this.articleFull = new ArticleFullView(this.options);

            this.articleFull.content.pipe(this.articleTop.scrollview);
            this.articleFull.content.pipe(this.articleBottom.scrollview);
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);

            this.cover.on('touchstart', function() {
                this.touch = true;
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
        content: null,
        thumbSm: null,
        thumbLg: null,

        margin: 20,
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
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
        this.enable = true;
        this.articleTop.enableScroll();
        this.articleBottom.content.pipe(this.articleTop.scrollview);
    };

    ArticleView.prototype.disableScroll = function() {
        this.enable = false;
        this.articleTop.disableScroll();
        this.articleBottom.content.unpipe(this.articleTop.scrollview);
    };

    ArticleView.prototype.sequence = function() {
        console.log('sequence');
    };

    ArticleView.prototype.setAngle = function(angle) {
        this.angle = angle;
    };

    ArticleView.prototype.render = function() {
        this.articleTop.setAngle(this.angle);
        this.articleBottom.setAngle(this.angle);
        // var namePos = this.map(120, 85);
        // var textPos = this.map(140, 105);
        // var photoPos = this.map(-20, -68);
        // var footerPos = this.map(48, 0);

        // this.profilePicsView.setProgress(this.progress);
        // this.nameView.setProgress(this.progress);
        // this.nameView.fade(this.progress);
        // this.textView.fade(this.progress);

        this.atTop = Math.abs(this.articleTop.scrollview.getPosition()) < 1;
        console.log(this.atTop);

        this.spec = [];

        // this.mod0.setTransform(FM.translate(0, this.map(0, 0), 0.00001));
        // this.mod1.setTransform(FM.move(FM.rotateZ(this.map(-0.04, 0)), [this.map(-6, 0), this.map(-290, 0), 0]));

        this.articleBottom.scrollview.setPosition(this.articleTop.scrollview.getPosition());

        this.spec.push({
            target: this.articleFull.render()
        });

        if(this.angle === 0) {
            // this.articleFull.show();
        }

        // if(this.angle !== 0) {
            this.articleFull.hide();

            this.spec.push({
                transform: FM.translate(0, 0, 0),
                target: this.articleTop.render()
            });

            this.spec.push({
                transform: FM.translate(0, 320, 0),
                target: this.articleBottom.render()
            });

            this.spec.push({
                transform: FM.translate(0, 0, 5),
                // target: this.cover.render()
            });
        // }

        return this.spec;
    };

    module.exports = ArticleView;
});
