define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');

    function FooterView() {
        this.img = new Image();
        this.img.src = '../content/footer.png';
        this.img.width = 280;

        var surface = new Surface({
            size: [280, 50],
            content: this.img
        });

        return surface;
    }

    module.exports = FooterView;
});
