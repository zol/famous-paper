define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Modifier            = require('famous/Modifier');

    var EventHandler        = require('famous/EventHandler');
    var GenericSync         = require('famous-sync/GenericSync');
    var Transitionable      = require('famous/Transitionable');
    var SpringTransition    = require('famous-physics/utils/SpringTransition');

    var Scrollview          = require('famous-views/Scrollview');
    var ViewSequence        = require('famous/ViewSequence');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');

    var StoryView           = require('./StoryView');
    var Data                = require('./Data');
    var Interpolate         = require('./utils/Interpolate');

    Transitionable.registerMethod('spring', SpringTransition);

    function StoriesView() {
        View.apply(this, arguments);

        createSyncs.call(this);
        createStories.call(this);
        setYListeners.call(this);

        this.scale = new Interpolate({
            input_1: 0,
            input_2: this.options.initY,
            output_1: 1,
            output_2: this.options.cardScale
        });

        window.app = this;
    }

    StoriesView.prototype = Object.create(View.prototype);
    StoriesView.prototype.constructor = StoriesView;

    StoriesView.DEFAULT_OPTIONS = {
        velThreshold: 1,
        spring: {
            method: 'spring',
            period: 300,
            dampingRatio: 1,
        },
        curve: {
            duration: 500,
            curve: 'easeOut'
        },

        cardScale: 0.445,
        gutter: 2
    };
    StoriesView.DEFAULT_OPTIONS.cardWidth = StoriesView.DEFAULT_OPTIONS.cardScale * window.innerWidth;

    StoriesView.DEFAULT_OPTIONS.cardHeight = StoriesView.DEFAULT_OPTIONS.cardScale * window.innerHeight;
    StoriesView.DEFAULT_OPTIONS.initY = window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight;
    StoriesView.DEFAULT_OPTIONS.posThreshold = (window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight)/2;


    StoriesView.DEFAULT_OPTIONS.scrollOpts = {
        direction: Utility.Direction.X,
        defaultItemSize: [StoriesView.DEFAULT_OPTIONS.cardWidth, StoriesView.DEFAULT_OPTIONS.cardHeight],
        itemSpacing: 2/StoriesView.DEFAULT_OPTIONS.cardScale,
        margin: window.innerWidth*6,
        pageSwitchSpeed: 0.1,
        pagePeriod: 300,
        pageDamp: 1,
        speedLimit: 8,
        drag: 0.001
    };

    var createStories = function() {
        this.storiesHandler = new EventHandler();

        this.scrollview = new Scrollview(this.options.scrollOpts);

        this.stories = [];
        for(var i = 0; i < Data.length; i++) {
            var story = new StoryView({
                scale: this.options.cardScale,
                name: Data[i].name,
                profilePic: Data[i].profilePic,
                text: Data[i].text,
                photos: Data[i].photos,
                time: Data[i].time,
                likes: Data[i].likes,
                comments: Data[i].comments
            });

            story.pipe(this.storiesHandler);
            this.stories.push(story);

            story.on('click', function() {
                console.log('touch')
                // this.toggle();
            }.bind(this));
        }

        this.storiesHandler.pipe(this.scrollview);
        this.storiesHandler.pipe(this.ySync);

        var sequence = new ViewSequence(this.stories, 0, false);

        this.scrollview.sequenceFrom(sequence);
        this.state = 'down';
    };

    var createSyncs = function() {
        this.yPos = new Transitionable(this.options.initY);

        this.ySync = new GenericSync(function() {
            return [0, this.yPos.get()];
        }.bind(this));
    };

    var setYListeners = function() {
        this.ySync.on('start', function(data) {
            this.direction = undefined;
        }.bind(this));

        this.ySync.on('update', (function(data) {
            if(!this.direction) {
                if(Math.abs(data.v[1]) > Math.abs(data.v[0])) {
                    // this.storiesHandler.unpipe(this.scrollview);
                    this.direction = 'y';
                } else {
                    this.storiesHandler.unpipe(this.ySync);
                    this.direction = 'x';
                }
            }

            this.xPos = data.p[0];
            if(this.direction === 'y') {
                this.yPos.set(Math.min(this.options.initY + 75, Math.max(-75, data.p[1])));
            }
        }).bind(this));

        this.ySync.on('end', (function(data) {
            this.direction = undefined;

            this.storiesHandler.pipe(this.ySync);

            var velocity = data.v[1].toFixed(2);

            if(this.yPos.get() < this.options.posThreshold) {
                console.log(this.state, velocity)
                if(velocity > this.options.velThreshold) {
                    console.log(this.state, velocity);
                    this.slideDown(velocity);
                } else {
                    this.slideUp(Math.abs(velocity));
                }
            } else {
                if(velocity < -this.options.velThreshold) {
                    this.slideUp(Math.abs(velocity));
                } else {
                    this.slideDown(velocity);
                }
            }
        }).bind(this));
    };

    StoriesView.prototype.toggle = function() {
        if(this.up) this.slideDown();
        else this.slideUp();
        this.up = !this.up;
    };

    StoriesView.prototype.slideUp = function(velocity) {
        console.log('slide up');
        var spring = this.options.spring;
        spring.velocity = velocity;

        this.options.scrollOpts.paginated = true;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.yPos.set(0, spring, function() {
            this.state = 'up';
        }.bind(this));

    };

    StoriesView.prototype.slideDown = function(velocity) {
        console.log('slide down');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.options.scrollOpts.paginated = false;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.yPos.set(this.options.initY, spring, function() {
            this.state = 'down';
        }.bind(this));
    };

    StoriesView.prototype.render = function() {
        var yPos = this.yPos.get();
        var scale = this.scale.calc(yPos);
        this.progress = Utils.map(yPos, this.options.initY, 0, 0, 1, true);

        this.scrollview.sync.setOptions({
            direction: GenericSync.DIRECTION_X,
            scale: 1/scale
        });

        for(var i = 0; i < this.stories.length; i++) {
            this.stories[i].setProgress(this.progress);
        }

        this.spec = [];
        this.spec.push({
            origin: [0.5, 1],
            transform: FM.multiply(FM.aboutOrigin([0, 0, 0], FM.scale(scale, scale, 1)), 
                FM.translate(0, 0, 0)),
            target: {
                size: [window.innerWidth, window.innerHeight],
                target: this.scrollview.render()
            }
        });

        return this.spec;
    };

    module.exports = StoriesView;
});
