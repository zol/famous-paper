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

    var StoriesView         = require('./StoryViews/StoriesView');

    Transitionable.registerMethod('spring', SpringTransition);

    function App() {
        View.apply(this, arguments);

        this.storiesView = new StoriesView();
    }

    App.prototype = Object.create(View.prototype);
    App.prototype.constructor = App;

    App.DEFAULT_OPTIONS = {
    };

    App.prototype.render = function() {
        this.spec = [];
        this.spec.push({
            target: this.storiesView.render()
        });

        return this.spec;
    };

    module.exports = App;
});