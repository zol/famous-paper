define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Modifier            = require('famous/Modifier');
    var RenderNode          = require('famous/RenderNode');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Scrollview          = require('famous-views/Scrollview');

    function ArticleFullView() {
        View.apply(this, arguments);

        createBacking.call(this);
        createScrollview.call(this);
    }

    function createBacking() {
        var surface = new Surface({
            size: [undefined, undefined],
            properties: {
                backgroundColor: 'white'
            }
        });

        this._add(surface);
    }

    function createScrollview() {
        this.scrollview = new Scrollview(this.options.svOpts);

        this.content = new Surface({
            size: [320, 1080],
            classes: ['article', 'content'],
            content: this.options.content,
            properties: {
                backgroundColor: 'white'
            }
        });

        this.content.getSize = function() {
            return [320, 1080]
        };

        this.scrollview.sequenceFrom([this.content]);
        this.content.pipe(this.scrollview);

        this._add(this.scrollview);
    }

    ArticleFullView.prototype = Object.create(View.prototype);
    ArticleFullView.prototype.constructor = ArticleFullView;

    ArticleFullView.DEFAULT_OPTIONS = {
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

    module.exports = ArticleFullView;
});