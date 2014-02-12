define(function(require, exports, module) {
    var Engine              = require('famous/Engine');
    var Modifier            = require('famous/Modifier');
    var Surface             = require('famous/Surface');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');
    var Easing              = require('famous-animation/Easing');
    var GenericSync         = require('famous-sync/GenericSync');
    var Transitionable      = require('famous/Transitionable');
    var SpringTransition    = require('famous-physics/utils/SpringTransition');
    var Lightbox            = require('famous-views/LightBox');
    var Time                = require('famous-utils/Time');

    var StoriesView         = require('./StoryViews/StoriesView');
    var CoverView           = require('./CoverViews/CoverView');
    var CoverData           = require('./Data/CoverData');

    Transitionable.registerMethod('spring', SpringTransition);

    function App() {
        View.apply(this, arguments);

        this.storiesView = new StoriesView();
        this.lightbox = new Lightbox({
            inTransform: FM.identity,
            inOpacity: 0,
            inOrigin: [0.5, 0.5],
            outTransform: FM.identity,
            outOpacity: 0,
            outOrigin: [0.5, 0.5],
            showTransform: FM.identity,
            showOpacity: 1,
            showOrigin: [0.5, 0.5],
            inTransition: {
                duration: 1000
            },
            outTransition: {
                duration: 1000
            },
            overlap: true
        });

        this.covers = [];
        for(var i = 0; i < CoverData.length; i++) {
            var cover = new CoverView(CoverData[i]);
            this.covers.push(cover);
        }

        var i = 0;
        this.lightbox.show(this.covers[0]);

        Time.setInterval(function() {
            i++;
            if(i === this.covers.length) i = 0;
            this.lightbox.show(this.covers[i]);
        }.bind(this), 4000);


        var mod = new Modifier({
            transform: FM.translate(0, 0, -0.1)
        });

        this._add(mod).link(this.lightbox);
        this._add(this.storiesView);
    }

    App.prototype = Object.create(View.prototype);
    App.prototype.constructor = App;

    App.DEFAULT_OPTIONS = {
    };

    module.exports = App;
});