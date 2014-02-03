define(function(require, exports, module) {
    var Engine          = require('famous/Engine');
    var Modifier        = require('famous/Modifier');
    var FM              = require('famous/Matrix');
    var Easing          = require('famous-animation/Easing');

    var AppView         = require('app/appView');

    var Context = Engine.createContext();

    var appView = new AppView();
    var appMod = new Modifier();

    Context.add(appMod).link(appView);
});
