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

        function createArticleTop() {
            this.articleTop = new ArticleTopView(this.options);

            this.articleTop.pipe(this.eventOutput);
        }

        function createArticleBottom() {
            this.articleBottom = new ArticleBottomView(this.options);

            this.articleBottom.pipe(this.eventOutput);
            this.articleBottom.content.pipe(this.articleTop.scrollview);
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);
            this.cover.pipe(this.articleTop.scrollview);
            this.cover.pipe(this.articleBottom.scrollview);

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
        this.articleTop.enableScroll();
        this.articleBottom.enableScroll();
    };

    ArticleView.prototype.disableScroll = function() {
        this.articleTop.disableScroll();
        this.articleBottom.disableScroll();
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

        this.atTop = Math.abs(this.articleTop.scrollview.getPosition()) < 5;

        this.spec = [];

        this.spec.push({
            transform: FM.translate(0, 0, 0),
            target: this.articleTop.render()
        });

        this.spec.push({
            transform: FM.translate(0, 320, 0),
            target: this.articleBottom.render()
        });

        return this.spec;
    };

    module.exports = ArticleView;
});
