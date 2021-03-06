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

    var StoryData           = require('../Data/StoryData');
    var StoryView           = require('./StoryView');
    var PhotoStoryView      = require('./PhotoStoryView');
    var ArticleStoryView    = require('./ArticleStoryView');

    Transitionable.registerMethod('spring', SpringTransition);

    function StoriesView() {
        View.apply(this, arguments);

        createSyncs.call(this);
        createStories.call(this);
        setYListeners.call(this);

        window.app = this;
    }

    StoriesView.prototype = Object.create(View.prototype);
    StoriesView.prototype.constructor = StoriesView;

    StoriesView.DEFAULT_OPTIONS = {
        velThreshold: 0.7,
        spring: {
            method: 'spring',
            period: 200,
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
        margin: window.innerWidth*3,
        pageSwitchSpeed: 0.1,
        pagePeriod: 300,
        pageDamp: 1,
        speedLimit: 10,
        drag: 0.001
    };

    var createStories = function() {
        this.storiesHandler = new EventHandler();

        this.scrollview = new Scrollview(this.options.scrollOpts);

        this.stories = [];

        for(var i = 0; i < StoryData.length; i++) {
            var story;
            var info = {
                profilePics: StoryData[i].profilePics,
                name: StoryData[i].name,
                text: StoryData[i].text,
                time: StoryData[i].time,
                likes: StoryData[i].likes,
                comments: StoryData[i].comments,
                scale: this.options.cardScale
            }

            if(StoryData[i].article) {
                info.content = StoryData[i].article;
                info.thumbSm = StoryData[i].articleThumbSm;
                info.thumbLg = StoryData[i].articleThumbLg;
                info.velThreshold = this.options.velThreshold;

                story = new ArticleStoryView(info);
            } else {
                info.photos = StoryData[i].photos;

                if(StoryData[i].photos && StoryData[i].photos.length > 1) {
                    story = new PhotoStoryView(info);
                } else {
                    story = new StoryView(info);
                }
            }

            story.pipe(this.storiesHandler);
            this.stories.push(story);

            story.on('touchstart', function(story) {
                this.targetStory = story;
            }.bind(this, story));
        }

        this.storiesHandler.pipe(this.scrollview);
        this.storiesHandler.pipe(this.ySync);

        var sequence = new ViewSequence(this.stories, 0, true);

        this.scrollview.sequenceFrom(sequence);

        this.scrollview.on('paginate', function() {
            if(this.targetStory.sequence) {
                this.targetStory.sequence();
                this.targetStory.disableScroll();
            }
        }.bind(this));
    };

    var createSyncs = function() {
        this.yPos = new Transitionable(this.options.initY);

        this.ySync = new GenericSync(function() {
            return [0, this.yPos.get()];
        }.bind(this));
    };

    var setYListeners = function() {
        this.ySync.on('start', function(data) {
            var yPos = this.yPos.get();

            this.direction = undefined;
            if(yPos === 0 && this.targetStory.scrollable) {
                this.targetStory.enableScroll();
            }

            if(yPos === 0 && this.targetStory.flipable) {
                this.targetStory.enableFlip();
            }

            this.enableY = false;
        }.bind(this));

        this.ySync.on('update', function(data) {
            var yPos = this.yPos.get();

            if(!this.direction) {
                if(Math.abs(data.v[1]) > Math.abs(data.v[0])) {
                    this.direction = 'y';
                } else {
                    this.storiesHandler.unpipe(this.ySync);
                    this.direction = 'x';
                }
            }

            if(this.direction === 'y') {
                if(yPos !== 0) {
                    this.enableY = true;
                    this.swipeY = true;
                } else {
                    if(!this.targetStory.scrollable && !this.targetStory.flipable) {
                        this.enableY = true;
                    }

                    if(this.targetStory.scrollable && this.targetStory.top && data.v[1] > 0) {
                        this.targetStory.disableScroll();
                        this.enableY = true;
                    }

                    if(this.targetStory.flipable && this.targetStory.closed && data.v[1] > 0) {
                        this.targetStory.disableFlip();
                        this.enableY = true;
                    }
                }

                if(this.enableY) {
                    this.yPos.set(Math.min(this.options.initY + 75, Math.max(-75, data.p[1])));
                }
            } else {
                if(this.targetStory.scrollable && Math.abs(this.targetStory.scrollview.getVelocity()) > 0.05) {
                    this.storiesHandler.unpipe(this.scrollview);
                }
            }
        }.bind(this));

        this.ySync.on('end', (function(data) {
            this.storiesHandler.pipe(this.scrollview);
            this.storiesHandler.pipe(this.ySync);

            var velocity = data.v[1].toFixed(2);

            if(!this.enableY) return;

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
                }
            }
        }).bind(this));
    };

    StoriesView.prototype.slideUp = function(velocity) {
        console.log('slide up');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.options.scrollOpts.paginated = true;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.yPos.set(0, spring);

    };

    StoriesView.prototype.slideDown = function(velocity) {
        console.log('slide down');

        var spring = this.options.spring;
        spring.velocity = velocity;

        this.options.scrollOpts.paginated = false;
        this.scrollview.setOptions(this.options.scrollOpts);

        this.yPos.set(this.options.initY, spring);
    };

    StoriesView.prototype.render = function() {
        var yPos = this.yPos.get();
        var scale = Utils.map(yPos, 0, this.options.initY, 1, this.options.cardScale);
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
            transform: FM.scale(scale, scale, 1),
            target: {
                size: [window.innerWidth, window.innerHeight],
                target: this.scrollview.render()
            }
        });

        return this.spec;
    };

    module.exports = StoriesView;
});
