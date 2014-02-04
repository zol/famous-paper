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

    Transitionable.registerMethod('spring', SpringTransition);

    function StoriesView() {
        View.apply(this, arguments);

        setupSync.call(this);
        createStories.call(this);
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

        storyWidth: 142,
        storyHeight: 253,
        gutter: 2,
        margin: 20
    };
    StoriesView.DEFAULT_OPTIONS.posThreshold = (window.innerHeight - StoriesView.DEFAULT_OPTIONS.storyHeight)/2;

    StoriesView.prototype.slideUp = function(velocity) {
        console.log('slide up');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.storyPos.set(0, spring);
    };

    StoriesView.prototype.slideDown = function(velocity) {
        console.log('slide down');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.storyPos.set(window.innerHeight - this.options.storyHeight, spring);
    };

    StoriesView.prototype.render = function() {
        this.spec = [];

        this.spec.push({
            transform: FM.translate(0, this.storyPos.get(), 0),
            target: this.scrollview.render()
        });
        return this.spec;
    };

    var createStories = function() {
        var container = new ContainerSurface();
        this.scrollview = new Scrollview({
            direction: Utility.Direction.X,
            defaultItemSize: [this.options.storyWidth, this.options.storyHeight],
            itemSpacing: this.options.gutter,
            drag: 0.005
        });

        var stories = [];
        for(var i = 0; i < Data.length; i++) {
            var story = new StoryView({
                name: Data[i].name,
                profilePic: Data[i].profilePic,
                cardWidth: this.options.storyWidth,
                cardHeight: this.options.storyHeight
            });

            story.pipe(this.scrollview);
            story.pipe(this.sync);
            stories.push(story);
        }

        this.scrollview.sequenceFrom(stories);
    };

    var setupSync = function() {
        this.storyPos = new Transitionable(window.innerHeight - this.options.storyHeight);
        // this.storyPos = new Transitionable(0);

        this.sync = new GenericSync((function() {
            return this.storyPos.get();
        }).bind(this), {direction: GenericSync.DIRECTION_Y});

        this.sync.on('start', (function() {

        }).bind(this));

        this.sync.on('update', (function(data) {
            console.log(data.p);

            this.storyPos.set(Math.max(0, data.p));
        }).bind(this));

        this.sync.on('end', (function(data) {
            console.log(this.storyPos.get(), this.options.posThreshold);
            var velocity = data.v.toFixed(2);
            console.log(velocity);

            if(this.storyPos.get() < this.options.posThreshold) {
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
                    console.log(this.storyPos.get(), velocity, this.options.velThreshold);

                }
            }
        }).bind(this));
    };

    module.exports = StoriesView;
});