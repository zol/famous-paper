define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Scrollview          = require('famous-views/Scrollview');

    function ArticleCoverView() {
        View.apply(this, arguments);

        createBacking.call(this);
        createScrollview.call(this);
    }

    function createBacking() {
        var surface = new Surface({
            size: [undefined, window.innerHeight/2],
            properties: {
                backgroundColor: '#999'
            }
        });

        var mod = new Modifier({
            origin: [0, 0]
        });

        this._add(mod).link(surface);
    }

    function createScrollview() {
        this.scrollview = new Scrollview(this.options.svOpts);

        var sequence = [];

        this.headerImg = new Image();
        this.headerImg.src = this.options.content[0];
        this.headerImg.width = 320;

        var header = new Surface({
            size: [320, 158],
            content: this.headerImg
        });

        header.getSize = function() {
            return [320, 148];
        };

        var content = new Surface({
            size: [280, 900],
            classes: ['article', 'content'],
            content: this.options.content[1],
            properties: {
                backgroundColor: 'white'
            }
        });

        content.getSize = function() {
            return [280, 920]
        };

        sequence.push(header);
        sequence.push(content);

        this.scrollview.sequenceFrom(sequence);

        this.svMod = new Modifier({
            origin: [0.5, 0]
        });

        this.container = new ContainerSurface({
            size: [undefined, window.innerHeight/2],
            properties: {
                overflow: 'hidden'
            }
        });

        this.container.add(this.svMod).link(this.scrollview);

        this._add(this.container);
    }

    ArticleCoverView.prototype = Object.create(View.prototype);
    ArticleCoverView.prototype.constructor = ArticleCoverView;

    ArticleCoverView.DEFAULT_OPTIONS = {
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

    module.exports = ArticleCoverView;
});