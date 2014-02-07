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
            this.scrollview.sequenceFrom(this.snapNode);
            console.log('setttt');
            this.up = true;
        }.bind(this));

        // this.options.scrollOpts.paginated = true;
        this.scrollview.setOptions(this.options.scrollOpts);

        // this.up = true;
    };

    StoriesView.prototype.slideDown = function(velocity) {
        console.log('slide down');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.yPos.set(window.innerHeight - this.options.cardHeight, this.options.curve, function() {
            this.xOffset.set(0);

            this.down = true;
        }.bind(this));

        this.options.scrollOpts.paginated = false;
        this.scrollview.setOptions(this.options.scrollOpts);
    };

var scaleCache;

    StoriesView.prototype.render = function() {
        var yPos = this.yPos.get();
        this.scale = Utils.map(yPos, 0, this.options.initCardPos, 1/this.options.cardScale, 1);

if(scaleCache !== this.scale) {
    // console.log(this.scale);
    scaleCache = this.scale;
}

        this.scrollview.sync.setOptions({
            direction: GenericSync.DIRECTION_X,
            scale: 1/this.scale
        });



        // this.options.scrollOpts.defaultItemSize[0] = this.options.cardWidth*scale;
        // this.options.scrollOpts.itemSpacing = 2 - (scale-1)*this.options.cardWidth;
        this.options.scrollOpts.clipSize = window.innerWidth/scale;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.spec = [];

        var xStart = this.xStart || 0;

        if(this.moveUp) {
            this.xOffset.set(this.xOffsetScale.calc(xStart*scale)*xStart/this.options.cardScale/1.8);
        }

        if(this.moveDown) {
            this.xOffset.set(0);
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

        this.down = true;
    };

    var createSyncs = function() {
        this.yPos = new Transitionable(this.options.initCardPos);
        this.xOffsetMap = new Interpolate({
            input_1: 0,
            input_2: 320,
            output_1: 0,
            output_2: -1000*this.options.cardScale
        });


        this.ySync = new GenericSync(function() {
            return [0, this.yPos.get()];
        }.bind(this));
    };

    var setYListeners = function() {
        this.ySync.on('start', function(data) {
            var x = data.pos[0];
            var scrollPos = this.scrollview.getPosition();
            var scale = this.options.cardScale;
            this.touch = true;

            this.firstTouch = true;

            if(this.down) {
                this.xStart = x;

                if(x < this.options.cardWidth - scrollPos) {
                    this.snapPos = 0;
                    this.snapNode = this.scrollview.getCurrentNode();
                } else if(x < 2*this.options.cardWidth - scrollPos) {
                    this.snapPos = (this.options.cardWidth)/this.options.cardScale;
                    this.snapNode = this.scrollview.getCurrentNode().getNext();
                } else {
                    this.snapPos = (2*this.options.cardWidth)/this.options.cardScale;
                    this.snapNode = this.scrollview.getCurrentNode().getNext().getNext();
                }
            }

            if(this.up) {
                this.xStart = x*scale;
            }
console.log(this.xStart, x);

            this.xOffsetScale = new Interpolate({
                input_1: this.xStart,
                input_2: this.xStart/scale,
                output_1: 0,
                output_2: 1
            });
        }.bind(this));

        this.ySync.on('update', (function(data) {
            console.log(this.firstTouch)
            if(this.firstTouch) {
                if(Math.abs(data.v[1]) > Math.abs(data.v[0])) {
                    this.storiesHandler.unpipe(this.scrollview);
                    if(this.down) this.moveUp = true;
                    if(this.up) this.moveDown = true;
                    this.up = false;
                    this.down = false;
                } else {
                    this.storiesHandler.unpipe(this.ySync);
                }
                this.firstTouch = false;
            }

            if(this.moveUp || this.moveDown) {
                this.yPos.set(Math.max(0, data.p[1]));
                this.xPos.set(data.p[0]);
            }
        }).bind(this));

        this.ySync.on('end', (function(data) {
            this.storiesHandler.pipe(this.ySync);
            this.storiesHandler.pipe(this.scrollview);

            this.touch = false;

            var velocity = data.v[1].toFixed(2);
            // console.log(velocity);

            if(this.moveUp || this.moveDown) {
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

                if(this.moveUp) {
                    this.xOffset.set(this.snapPos, this.options.curve);
                    this.xPos.set(0, this.options.curve);
                    this.moveUp = false;                
                } else {
                    this.moveDown = false;
                }
            }

                // this.scrollview.sequenceFrom(this.scrollview.getCurrentNode().getNext());
                // this.scrollview.setPosition((this.scrollview.getPosition() - this.options.cardWidth)/this.scale.calc(this.yPos.get()));
                // this.scrollview.goToNextPage();
        }).bind(this));
    };

    module.exports = StoriesView;
});