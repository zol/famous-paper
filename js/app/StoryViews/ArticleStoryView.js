define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    // var GenericSync         = require('famous-sync/GenericSync');
    // var Transitionable      = require('famous/Transitionable');
    // var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Scrollview          = require('famous-views/Scrollview');
    var ContainerSurface    = require('famous/ContainerSurface');
    var Utility             = require('famous/Utility');
    var Utils               = require('famous-utils/Utils');

    var ProfilePicsView     = require('./ProfilePicsView');
    var NameView            = require('./NameView');
    var TextView            = require('./TextView');
    var ArticleView         = require('./ArticleViews/ArticleView');
    var FooterView          = require('./FooterView');

    // Transitionable.registerMethod('spring', SpringTransition);

    function ArticleStoryView() {
        View.apply(this, arguments);

        this.scrollable = true;

        this.contentWidth = window.innerWidth - 2*this.options.margin;

        createCard.call(this);
        createProfilePic.call(this);
        createName.call(this);
        createText.call(this);
        createArticle.call(this);
        createFooter.call(this);
        createCover.call(this);

        function createCard() {
            this.card = new Surface({
                properties: {
                    borderRadius: '5px',
                    backgroundColor: 'white'
                }
            });
        }

        function createProfilePic() {
            this.profilePicsView = new ProfilePicsView({
                scale: this.options.scale,
                urls: this.options.profilePics
            });
        }

        function createName() {
            this.nameView = new NameView({
                name: this.options.name
            });
        }

        function createText() {
            if(!this.options.text) return;

            this.textView = new TextView({
                text: this.options.text,
                time: this.options.time,
                photos: true
            });
        }

        function createArticle() {
            this.article = new ArticleView({
                scale: this.options.scale,
                content: this.options.content,
                thumbSm: this.options.thumbSm,
                thumbLg: this.options.thumbLg,
            });
        }

        function createFooter() {
            this.footer = new FooterView({
                likes: this.options.likes,
                comments: this.options.comments
            });
        }

        function createCover() {
            this.cover = new Surface();
            this.cover.pipe(this.eventOutput);
        }
    }

    ArticleStoryView.prototype = Object.create(View.prototype);
    ArticleStoryView.prototype.constructor = ArticleStoryView;

    ArticleStoryView.DEFAULT_OPTIONS = {
        scale: null,
        name: null,
        profilePics: null,
        text: null,
        content: null,
        thumbSm: null,
        thumbLg: null,
        time: null,
        likes: null,
        comments: null,

        margin: 20
    };

    ArticleStoryView.prototype.getSize = function() {
    };

    ArticleStoryView.prototype.setProgress = function(progress) {
        this.progress = progress;
    };

    ArticleStoryView.prototype.map = function(start, end, clamp) {
        return Utils.map(this.progress, 0, 1, start, end, clamp);
    };

    ArticleStoryView.prototype.render = function() {
        var namePos = this.map(120, 85);
        var textPos = this.map(140, 105);
        var photoPos = this.map(-20, -68);
        var footerPos = this.map(48, 0);
        var profilePicScale = this.map(1/3/this.options.scale, 0.5);

        this.profilePicsView.setProgress(this.progress);
        this.nameView.fade(this.progress);
        this.textView.fade(this.progress);


        this.spec = [];
        this.spec.push(this.card.render());

        this.spec.push({
            transform: FM.translate(this.options.margin, this.options.margin, 0),
            target: this.profilePicsView.render()
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, namePos, 0),
            target: this.nameView.render()
        });

        if(this.textView) {
            this.spec.push({
                transform: FM.translate(this.options.margin, textPos, 0),
                size: [this.options.contentWidth, window.innerHeight - textPos - this.options.margin],
                target: {
                    target: this.textView.render()
                }
            });
        }

        this.spec.push({
            origin: [0.5, 0],
            transform: FM.translate(0, 0, 0.001),
            target: this.article.render()
        });

        this.spec.push({
            transform: FM.translate(this.options.margin, window.innerHeight - this.footer.getSize()[1], 0),
            opacity: Easing.inOutQuadNorm.call(this, this.progress),
            target: this.footer.render()
        });

        this.spec.push({
            transform: FM.translate(0, 0, 2),
            target: this.cover.render()
        });

        return this.spec;
    };

    module.exports = ArticleStoryView;
});
