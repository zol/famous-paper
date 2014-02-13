define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Scrollview          = require('famous-views/Scrollview');

    function ArticleBottomView() {
        View.apply(this, arguments);

        createBacking.call(this);
        createScrollview.call(this);
    }

    function createBacking() {
        this.backing = new Surface({
            size: [320, 320],
            properties: {
                boxShadow: this.options.boxShadow
            }
        });

        var mod = new Modifier({
            origin: [0, 0]
        });

        this._add(mod).link(this.backing);
    }

    function createScrollview() {
        this.scrollview = new Scrollview(this.options.svOpts);

        this.content = new Surface({
            size: [320, 1068],
            classes: ['article', 'content'],
            content: this.options.content,
            properties: {
                backgroundColor: 'white',
            }
        });

        this.content.getSize = function() {
            return [320, 1068]
        };

        this.content.pipe(this.eventOutput);

        this.scrollview.sequenceFrom([this.content]);

        this.svMod = new Modifier({
            origin: [0.5, 0],
            transform: FM.translate(0, -320, 0)
        });

        this.container = new ContainerSurface({
            size: [undefined, 320],
            properties: {
                overflow: 'hidden'
            }
        });

        this.container.add(this.svMod).link(this.scrollview);

        this.contMod = new Modifier();
        this._add(this.contMod).link(this.container);
    }

    ArticleBottomView.prototype = Object.create(View.prototype);
    ArticleBottomView.prototype.constructor = ArticleBottomView;

    ArticleBottomView.DEFAULT_OPTIONS = {
        scale: null,
        thumbCoverSm: null,
        thumbCoverLg: null,
        content: null,
        svOpts: {
            itemSpacing: 0,
            clipSize: window.innerHeight,
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
            speedLimit: 1
        },
        boxShadow: null
    };

    ArticleBottomView.prototype.setAngle = function(angle) {
        this.contMod.setTransform(FM.rotateX(0));
    };

    ArticleBottomView.prototype.enableScroll = function() {
        this.content.pipe(this.scrollview);
    };

    ArticleBottomView.prototype.disableScroll = function() {
        this.content.unpipe(this.scrollview);
    };

    ArticleBottomView.prototype.noShadow = function() {
        this.backing.setProperties({
            boxShadow: ''
        });
    };

    ArticleBottomView.prototype.shadow = function() {
        this.backing.setProperties({
            boxShadow: this.options.boxShadow
        });
    };

    module.exports = ArticleBottomView;
});