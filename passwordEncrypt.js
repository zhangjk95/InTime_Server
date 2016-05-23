var sha1 = require('sha1');

var config = require('./config');

module.exports = function(password) {
    return sha1(config.saltPrefix + password + config.saltSuffix);
};