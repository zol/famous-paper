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
        var surface = new Surface({
            size: [undefined, window.innerHeight/2],
            properties: {
                backgroundColor: 'white'
            }
        });

        var mod = new Modifier({
            origin: [0, 0]
        });

        this._add(mod).link(surface);
    }

    function createScrollview() {
        this.scrollview = new Scrollview(this.options.svOpts);

        this.content = new Surface({
            size: [320, 1068],
            classes: ['article', 'content'],
            content: this.options.content,
            properties: {
                backgroundColor: 'white'
            }
        });

        this.content.getSize = function() {
            return [320, 1068]
        };

        this.content.pipe(this.eventOutput);

        this.scrollview.sequenceFrom([this.content]);

        this.svMod = new Modifier({
            origin: [0.5, 0],
            transform: FM.translate(0, -window.innerHeight/2, 0)
        });

        this.container = new ContainerSurface({
            size: [undefined, window.innerHeight/2],
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
            edgePeriod: Infinity,
            // edgeDamp: 1,
            // paginated: false,
            // pagePeriod: 500,
            // pageDamp: 0.8,
            // pageStopSpeed: Infinity,
            // pageSwitchSpeed: 1,
            speedLimit: 10
        }
    };

    ArticleBottomView.prototype.setAngle = function(angle) {
        this.contMod.setTransform(FM.rotateX(0));
    };

    module.exports = ArticleBottomView;
});