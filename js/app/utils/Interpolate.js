define(function(require, exports, module) {
    function Interpolate(options) {
        var x_1 = options.input_1;
        var x_2 = options.input_2;
        var y_1 = options.output_1;
        var y_2 = options.output_2;

        this.slope = (y_2 - y_1)/(x_2 - x_1);

        this.intercept = y_2 - this.slope * x_2;
        console.log(y_1)
        console.log(this.slope, this.intercept);
    }

    Interpolate.prototype.calc = function(x) {
        return this.slope * x + this.intercept;
    }

    module.exports = Interpolate;
});