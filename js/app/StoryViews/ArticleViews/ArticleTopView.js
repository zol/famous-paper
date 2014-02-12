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
        createCover.call(this);
        // createBacking.call(this);
        createScrollview.call(this);
    }

    function createContainer() {
        this.container = new ContainerSurface({
            size: [undefined, 320],
            properties: {
                overflow: 'hidden'
            }
        });

        this.container.pipe(this.eventOutput);
    }

    function createCover() {
        this.coverLgImg = new Image();
        this.coverLgImg.src = this.options.thumbLg;
        this.coverLgImg.width = 320;

        this.coverLg = new Surface({
            size: [320, 274],
            content: this.coverLgImg,
            properties: {
                // boxShadow: this.options.boxShadow
            }
        });

        this.thumbLgMod = new Modifier();

        this.coverLg.pipe(this.eventOutput);

        this._add(this.thumbLgMod).link(this.coverLg);
    }

    function createBacking() {
        var backing = new Surface({
            size: [320, 320],
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
                backgroundColor: 'white',
                // boxShadow: this.options.boxShadow
            }
        });

        this.content.getSize = function() {
            return [320, 1068]
        };

        this.content.pipe(this.scrollview);
        this.scrollview.sequenceFrom([this.content]);

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
        thumbSm: null,
        thumbLg: null,
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
        },
        boxShadow: null
    };

    ArticleTopView.prototype.setAngle = function(angle) {
        this.contMod.setTransform(FM.aboutOrigin([0, 320, 0], FM.rotateX(-angle)));
        this.thumbLgMod.setTransform(FM.moveThen([0, 320, 0.001], FM.aboutOrigin([0, 320, 0], FM.rotate(-angle + Math.PI, 0, 0))));
    };

    ArticleTopView.prototype.enableScroll = function() {
        this.content.pipe(this.scrollview);
    };

    ArticleTopView.prototype.disableScroll = function() {
        this.content.unpipe(this.scrollview);
    };

    module.exports = ArticleTopView;
});