define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Modifier            = require('famous/Modifier');
    var Easing              = require('famous-animation/Easing');
    var GenericSync         = require('famous-sync/GenericSync');
    var Transitionable      = require('famous/Transitionable');
    var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');

    var StoryView           = require('./StoryView');
    var Data                = require('./Data');
    var Interpolate         = require('./utils/Interpolate');

    Transitionable.registerMethod('spring', SpringTransition);

    function StoriesView() {
        View.apply(this, arguments);

        createSyncs.call(this);
        createStories.call(this);
        setXListeners.call(this);
        setYListeners.call(this);

        this.scale = new Interpolate({
            input_1: 0,
            input_2: this.options.initCardPos,
            output_1: 1/this.options.cardScale,
            output_2: 1
        });
    }

    StoriesView.prototype = Object.create(View.prototype);
    StoriesView.prototype.constructor = StoriesView;

    StoriesView.DEFAULT_OPTIONS = {
        velThreshold: 0.75,
        spring: {
            method: 'spring',
            period: 500,
            dampingRatio: 0.9,
        },

        cardWidth: 142,
        cardScale: 0.445,
        gutter: 2,
        margin: 20
    };
    StoriesView.DEFAULT_OPTIONS.cardHeight = StoriesView.DEFAULT_OPTIONS.cardScale * window.innerHeight;
    StoriesView.DEFAULT_OPTIONS.initCardPos = window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight;
    StoriesView.DEFAULT_OPTIONS.posThreshold = (window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight)/2;

    StoriesView.prototype.slideUp = function(velocity) {
        console.log('slide up');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.yPos.set(0, spring);
    };

    StoriesView.prototype.slideDown = function(velocity) {
        console.log('slide down');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.yPos.set(window.innerHeight - this.options.cardHeight, spring);
    };

var scaleCache;

    StoriesView.prototype.render = function() {
        var storyPos = this.yPos.get();
        var scale = this.scale.calc(storyPos);

if(scaleCache !== scale) {
    console.log()
    scaleCache = scale;
}

        this.xSync.setOptions({
            direction: GenericSync.DIRECTION_X,
            scale: 1/scale
        });

        this.spec = [];

        this.spec.push({
            transform: FM.multiply(FM.scale(scale, scale, 1), FM.translate(0, storyPos, 0)),
            target: this.scrollview.render()
        });
        return this.spec;
    };

    var createStories = function() {
        var container = new ContainerSurface();
        this.scrollview = new Scrollview({
            direction: Utility.Direction.X,
            defaultItemSize: [this.options.cardWidth, this.options.cardHeight],
            itemSpacing: this.options.gutter,
            drag: 0.005
        });

        var stories = [];
        for(var i = 0; i < Data.length; i++) {
            var story = new StoryView({
                name: Data[i].name,
                profilePic: Data[i].profilePic,
                cardWidth: this.options.cardWidth,
                cardHeight: this.options.cardHeight
            });

            // story.pipe(this.scrollview);
            story.pipe(this.xSync);
            story.pipe(this.ySync);
            stories.push(story);
        }

        this.scrollview.sequenceFrom(stories);
    };

    var createSyncs = function() {
        this.yPos = new Transitionable(this.options.initCardPos);
        this.xPos = new Transitionable(0);

        this.ySync = new GenericSync((function() {
            return this.yPos.get();
        }).bind(this), {direction: GenericSync.DIRECTION_Y});

        this.xSync = new GenericSync((function() {
            return this.xPos.get();
        }).bind(this), {direction: GenericSync.DIRECTION_X});
    };

    var setXListeners = function() {
        this.xSync.pipe(this.scrollview);

        this.xSync.on('update', (function(data) {
            this.xPos.set(data.p);
        }).bind(this));
    };

    var setYListeners = function() {
        this.ySync.on('start', (function() {

        }).bind(this));

        this.ySync.on('update', (function(data) {
            this.yPos.set(Math.max(0, data.p));
        }).bind(this));

        this.ySync.on('end', (function(data) {
            var velocity = data.v.toFixed(2);
            console.log(velocity);

            if(this.yPos.get() < this.options.posThreshold) {
                if(velocity > this.options.velThreshold) {
                    this.slideDown(velocity);
                } else {
                    this.slideUp(Math.abs(velocity));
                }
            } else {
                if(velocity < -this.options.velThreshold) {
                    this.slideUp(Math.abs(velocity));
                } else {
                    this.slideDown(velocity);
                    console.log(this.yPos.get(), velocity, this.options.velThreshold);
                }
            }
        }).bind(this));
    };

    module.exports = StoriesView;
});