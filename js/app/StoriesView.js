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

    Transitionable.registerMethod('spring', SpringTransition);

    function StoriesView() {
        View.apply(this, arguments);

        createSyncs.call(this);
        createStories.call(this);
        setYListeners.call(this);

        this.eventArbiter = new EventArbiter();

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
        velThreshold: 1,
        spring: {
            method: 'spring',
            period: 2000,
            dampingRatio: 1,
        },
        curve: {
            duration: 300,
            curve: 'easeOut'
        },

        cardWidth: 142,
        cardScale: 0.445,
        gutter: 2,
        margin: 20
    };
    StoriesView.DEFAULT_OPTIONS.cardHeight = StoriesView.DEFAULT_OPTIONS.cardScale * window.innerHeight;
    StoriesView.DEFAULT_OPTIONS.initCardPos = window.innerHeight - StoriesView.DEFAULT_OPTIONS.cardHeight;
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

    StoriesView.prototype.slideUp = function(velocity) {
        // console.log('slide up');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.yPos.set(0, this.options.curve, function() {
            this.xOffset.set(0);
            // this.scrollview.sequenceFrom(this.scrollview.getCurrentNode().getNext());
            console.log('setttt');
            this.up = true;
        }.bind(this));

        this.options.scrollOpts.paginated = true;
        this.scrollview.setOptions(this.options.scrollOpts);

        // this.up = true;
    };

    StoriesView.prototype.slideDown = function(velocity) {
        console.log('slide down');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.yPos.set(window.innerHeight - this.options.cardHeight, this.options.curve, function() {this.up = false;}.bind(this));

        this.options.scrollOpts.paginated = false;
        this.scrollview.setOptions(this.options.scrollOpts);
    };

var scaleCache;
var xOffsetCache;
var upCache;

    StoriesView.prototype.render = function() {
        var xPos = this.xPos.get();
        var yPos = this.yPos.get();
        var scale = this.scale.calc(yPos);

if(scaleCache !== scale) {
    scaleCache = scale;
}

        this.scrollview.sync.setOptions({
            direction: GenericSync.DIRECTION_X,
            scale: 1/scale
        });

        // this.options.scrollOpts.defaultItemSize[0] = this.options.cardWidth*scale;
        // this.options.scrollOpts.itemSpacing = 2 - (scale-1)*this.options.cardWidth;
        this.options.scrollOpts.clipSize = window.innerWidth/scale;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.spec = [];

        var xStart = this.xStart || 0;

        if(this.touch && this.xOffsetScale) {
            this.xOffset.set(this.xOffsetScale.calc(xStart*scale)*xStart/this.options.cardScale/1.8);
        } else {
            // this.xOffset.set(0);
        }

        this.spec.push({
            origin: [0, 0],
            transform: FM.multiply(FM.scale(scale, scale, 1), FM.translate(this.xPos.get()-this.xOffset.get(), yPos, 0)),
            target: this.scrollview.render()
        });

        return this.spec;

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
                cardHeight: this.options.cardHeight
            });

            story.pipe(this.storiesHandler);
            this.stories.push(story);
        }

        this.storiesHandler.pipe(this.scrollview);
        this.storiesHandler.pipe(this.ySync);

        var sequence = new ViewSequence(this.stories, 0, true);

        this.scrollview.sequenceFrom(this.stories);
    };

    var createSyncs = function() {
        this.xPos = new Transitionable(0);
        this.yPos = new Transitionable(this.options.initCardPos);
        this.xOffset = new Transitionable(0);

        this.ySync = new GenericSync(function() {
            return [this.xPos.get(), this.yPos.get()];
        }.bind(this));
    };

    var setYListeners = function() {


        this.ySync.on('start', function(data) {
            this.firstTouch = true;

            if(!this.up) {
                var x = data.pos[0];
                var scrollPos = this.scrollview.getPosition();

                this.touch = true;
                console.log(this.scale.calc(this.yPos.get()))
                this.xStart = x/this.scale.calc(this.yPos.get());
                console.log(this.xStart)
                this.xOffsetScale = new Interpolate({
                    input_1: this.xStart,
                    input_2: this.xStart/this.options.cardScale,
                    output_1: 0,
                    output_2: 1
                });

                if(x < this.options.cardWidth - scrollPos) {
                    this.snapTo = 0;
                } else if(x < 2*this.options.cardWidth - scrollPos) {
                    this.snapTo = (this.options.cardWidth)/this.options.cardScale;
                } else {
                    this.snapTo = (2*this.options.cardWidth)/this.options.cardScale;
                }
                
            }
        }.bind(this));

        this.ySync.on('update', (function(data) {
            console.log(this.firstTouch)
            if(this.firstTouch) {
                if(Math.abs(data.v[1]) > Math.abs(data.v[0])) {
                    this.storiesHandler.unpipe(this.scrollview);
                    this.moveStories = true;
                    this.up = false;
                } else {
                    this.storiesHandler.unpipe(this.ySync);
                }
                this.firstTouch = false;
            }

            if(this.moveStories) {
                this.yPos.set(Math.max(0, data.p[1]));
                this.xPos.set(data.p[0]);            
            }
        }).bind(this));

        this.ySync.on('end', (function(data) {
            this.storiesHandler.pipe(this.ySync);
            this.storiesHandler.pipe(this.scrollview);

            this.touch = false;
            this.moveStories = false;

            var velocity = data.v[1].toFixed(2);
            // console.log(velocity);

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
                    // console.log(this.yPos.get(), velocity, this.options.velThreshold);
                }
            }

            if(!this.up) {
                this.xOffset.set(this.snapTo, this.options.curve);
                this.xPos.set(0, this.options.curve);
                // this.scrollview.sequenceFrom(this.scrollview.getCurrentNode().getNext());
                // this.scrollview.setPosition((this.scrollview.getPosition() - this.options.cardWidth)/this.scale.calc(this.yPos.get()));
                // this.scrollview.goToNextPage();
            }

        }).bind(this));
    };

    module.exports = StoriesView;
});