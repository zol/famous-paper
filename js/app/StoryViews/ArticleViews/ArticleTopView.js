define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Scrollview          = require('famous-views/Scrollview');

    function ArticleTopView() {
        View.apply(this, arguments);

        createContainer.call(this);
        createBacking.call(this);
        createScrollview.call(this);
    }

    function createContainer() {
        this.container = new ContainerSurface({
            size: [undefined, window.innerHeight/2],
            properties: {
                overflow: 'hidden'
            }
        });
    }

    function createBacking() {
        var backing = new Surface({
            size: [undefined, window.innerHeight/2],
            properties: {
                backgroundColor: 'white'
            }
        });

        this.container.add(backing);
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

        this.scrollview.sequenceFrom([this.content]);
        this.content.pipe(this.scrollview);

        var svMod = new Modifier({
            origin: [0.5, 0]
        });

        this.container.add(svMod).link(this.scrollview);

        this.contMod = new Modifier();
        this._add(this.contMod).link(this.container);
    }

    ArticleTopView.prototype = Object.create(View.prototype);
    ArticleTopView.prototype.constructor = ArticleTopView;

    ArticleTopView.DEFAULT_OPTIONS = {
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
            speedLimit: 10
        }
    };

    ArticleTopView.prototype.setAngle = function(angle) {
        this.contMod.setTransform(FM.aboutOrigin([0, window.innerHeight/2, 0], FM.rotateX(-angle)));
    };

    module.exports = ArticleTopView;
});