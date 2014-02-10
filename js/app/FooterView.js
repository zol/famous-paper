define(function(require, exports, module) {
    var Surface             = require('famous/Surface');
    var Modifier            = require('famous/Modifier');
    var FM                  = require('famous/Matrix');
    var View                = require('famous/View');

    function FooterView() {
        View.apply(this, arguments);

        this.img = new Image();
        this.img.src = './img/footer.png';
        this.img.width = this.options.width;

        var icons = new Surface({
            size: [this.options.width, 50],
            content: this.img
        });

        var likes = new Surface({
            size: [140, 40],
            content: 
                '<div class="footer-likes">' + 
                    this.options.likes + ' Likes &nbsp;' + 
                    this.options.comments + ' Comments' +
                '</div>' +
                '<div class="footer-write">Write a comment</div>'
        });

        var likesMod = new Modifier({
            origin: [1, 1],
            transform: FM.translate(-this.options.margin, 0, 0)
        });

        this._add(icons);
        this._add(likesMod).link(likes);
    }

    FooterView.prototype = Object.create(View.prototype);
    FooterView.prototype.constructor = FooterView;

    FooterView.DEFAULT_OPTIONS = {
        width: 280,
        likes: null,
        comments: null,
        margin: 20
    };

    FooterView.prototype.getSize = function() {
        return [280, 100];
    }

    module.exports = FooterView;
});
