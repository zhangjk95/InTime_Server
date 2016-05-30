var myUtil = {};

myUtil.zip = function() {
    arrays = [].slice.apply(arguments);
    return arrays[0].map(function(_, i) {
        return arrays.map(array => array[i]);
    });
};

module.exports = myUtil;