define(function(require, exports, module)
{
    var Engine          = require('famous/Engine');
    var Modifier        = require('famous/Modifier');

    var FM              = require('famous/Matrix');
    var Easing          = require('famous-animation/Easing');

    var AppView         = require('app/AppView');

    var Context = Engine.createContext();

    var appView = new AppView();

    Context.link(appView);
    Context.setPerspective(2000);
});
