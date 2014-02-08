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
    var EventArbiter        = require('famous/EventArbiter');
    var Time                = require('famous-utils/Time');
    var ViewSequence        = require('famous/ViewSequence');
    var EventHandler        = require('famous/EventHandler');

    var StoryView           = require('./StoryView');
    var Data                = require('./Data');
    var Interpolate         = require('./utils/Interpolate');
    window.matrix = FM;
    Transitionable.registerMethod('spring', SpringTransition);

    function StoriesView() {
        View.apply(this, arguments);

        createSyncs.call(this);
        createStories.call(this);
        setYListeners.call(this);

        this.eventArbiter = new EventArbiter();

        this.scale = new Interpolate({
            input_1: 0,
            input_2: this.options.initY,
            output_1: 1/this.options.cardScale,
            output_2: 1
        });

self = this;
    }

    StoriesView.prototype = Object.create(View.prototype);
    StoriesView.prototype.constructor = StoriesView;

    StoriesView.DEFAULT_OPTIONS = {
        velThreshold: 0.5,
        spring: {
            method: 'spring',
            period: 2000,
            dampingRatio: 1,
        },
        curve: {
            duration: 400,
            curve: 'easeOut'
        },

        cardWidth: 142,
        cardScale: 0.445,
        gutter: 2,
        margin: 20
    };
    StoriesView.DEFAULT_OPTIONS.cardHeight = StoriesView.DEFAULT_OPTIONS.cardScale * window.innerHeight;
    StoriesView.DEFAULT_OPTIONS.initY = window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight;
    StoriesView.DEFAULT_OPTIONS.posThreshold = (window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight)/2;
    // StoriesView.DEFAULT_OPTIONS.posThreshold = (window.innerHeight)/2;

    StoriesView.DEFAULT_OPTIONS.scrollOpts = {
        direction: Utility.Direction.X,
        defaultItemSize: [StoriesView.DEFAULT_OPTIONS.cardWidth, StoriesView.DEFAULT_OPTIONS.cardHeight],
        itemSpacing: 2,
        margin: window.innerWidth*10,
        pageSwitchSpeed: 0.1,
        pagePeriod: 300,
        pageDamp: 1,
        drag: 0.005
    };

    var createStories = function() {
        this.storiesHandler = new EventHandler();

        var container = new ContainerSurface();
        this.scrollview = new Scrollview(this.options.scrollOpts);

        this.stories = [];
        for(var i = 0; i < Data.length; i++) {
            var story = new StoryView({
                name: Data[i].name,
                profilePic: Data[i].profilePic,
                cardWidth: this.options.cardWidth,
                cardHeight: this.options.cardHeight,
                index: i
            });

            story.pipe(this.storiesHandler);
            this.stories.push(story);

            story.on('touchstart', function(story) {
                if(this.state === 'up') this.initX = 0;
                else this.initX = story.getPosition()[0];
                this.initIndex = story.getIndex();
            }.bind(this, story));
        }

        this.storiesHandler.pipe(this.scrollview);
        this.storiesHandler.pipe(this.ySync);

        var sequence = new ViewSequence(this.stories, 0, false);

        this.scrollview.sequenceFrom(sequence);

        this.state = 'down';
    };

    var createSyncs = function() {
        this.xPos = new Transitionable(0);
        this.yPos = new Transitionable(this.options.initY);
        this.xOffset = new Transitionable(0);

        this.ySync = new GenericSync(function() {
            return [this.xPos.get(), this.yPos.get()];
        }.bind(this));
    };

    var setYListeners = function() {
        this.ySync.on('start', function(data) {
            var x = data.pos[0];
            this.touch = true;

            if(this.state === 'down') {
                this.xStart = x;
                this.snapNode = findNode.call(this);
            }

            this.xOffsetScale = new Interpolate({
                input_1: this.xStart,
                input_2: this.xStart/this.options.cardScale,
                output_1: 0,
                output_2: 1
            });

            this.direction = undefined;

            function findNode() {
                var node = this.scrollview.node;
                while(node.index < this.initIndex) {
                    node = node._next;
                }

                // console.log(node.index)
                // console.log(node.array[node.index].options.name);
                return node;
            }

        }.bind(this));

        this.ySync.on('update', (function(data) {
            if(!this.direction) {
                if(Math.abs(data.v[1]) > Math.abs(data.v[0])) {
                    this.storiesHandler.unpipe(this.scrollview);
                    this.direction = 'y';

                    if(this.state === 'down') {
                        // console.log('sequence')
                        this.scrollview.sequenceFrom(this.snapNode);
                        this.xPos.set(this.initX);                        
                    }
                } else {
                    this.storiesHandler.unpipe(this.ySync);
                    this.direction = 'x';
                }
            }

            if(this.direction === 'y') {
                this.xPos.set(this.initX += data.d[0]);
            }

            if(this.direction === 'x' && this.state === 'up') {
                // this.xPos.set(0);
            }

            this.yPos.set(Math.max(0, data.p[1]));
            if(this.direction === 'x') {
                if(this.state === 'down') this.yPos.set(this.options.initY);
                if(this.state === 'up') this.yPos.set(0);
            }
        }).bind(this));

        this.ySync.on('end', (function(data) {
            this.storiesHandler.pipe(this.ySync);
            this.storiesHandler.pipe(this.scrollview);

            this.touch = false;

            var velocity = data.v[1].toFixed(2);
            // console.log(velocity);
            if(this.state === 'up') {
                console.log(this.state, velocity)
                if(velocity > this.options.velThreshold) {
                    console.log(this.state, velocity);
                    this.slideDown(velocity);
                } else {
                    this.slideUp(Math.abs(velocity));
                }
            }
            if(this.state === 'down') {
                console.log(this.state, velocity)
                if(velocity < -this.options.velThreshold) {
                    this.slideUp(Math.abs(velocity));
                } else {
                    this.slideDown(velocity);
                }
            }

        }).bind(this));
    };


    StoriesView.prototype.slideUp = function(velocity) {
        console.log('slide up');

        this.options.scrollOpts.paginated = true;
        this.xPos.set(0, this.options.curve);
        this.yPos.set(0, this.options.curve, function() {
            this.state = 'up';
            console.log(this.state)
            // this.scrollview.setOptions(this.options.scrollOpts);
        }.bind(this));

    };

    StoriesView.prototype.slideDown = function(velocity) {
        console.log('slide down');

        // this.xOffset.set(0, this.options.curve);
        this.xPos.set(0, this.options.curve);

        this.yPos.set(window.innerHeight - this.options.cardHeight, this.options.curve, function() {
            this.state = 'down';
        }.bind(this));

        this.options.scrollOpts.paginated = false;
        // this.scrollview.setOptions(this.options.scrollOpts);
    };

    StoriesView.prototype.render = function() {
        var xPos = this.xPos.get();
        var yPos = this.yPos.get();
        var scale = this.scale.calc(yPos);

        this.scrollview.sync.setOptions({
            direction: GenericSync.DIRECTION_X,
            scale: 1/scale
        });

        this.options.scrollOpts.clipSize = window.innerWidth/scale;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.spec = [];
console.log(this.state)
        var xStart = this.xStart || 0;

        this.spec.push({
            origin: [0, 0],
            transform: FM.multiply(FM.scale(scale, scale, 1), FM.translate(xPos, yPos, 0)),
            target: this.scrollview.render()
        });

        return this.spec;

    };

    module.exports = StoriesView;
});