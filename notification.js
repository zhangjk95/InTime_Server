var gcm = require('node-gcm');
var ObjectId = require('mongoose').Types.ObjectId;

var config = require('./config');
var myUtil = require('./myUtil');
var User = require(__base + 'models/user');
var Notification = require(__base + 'models/notification');

var save = function(uid, type, message, details) {
    var notification = new Notification({
        uid: uid,
        type: type,
        message: message,
        details: details,
        read: false
    });

    notification.save(function(err) {
        if (err) return console.error(err);
    });
};

var send = function(uid, type, message, details) {
    User.findOne({ _id: ObjectId(uid) }, function(err, user) {
        if (err) return console.error(err);
        if (!user.reg_tokens || user.reg_tokens.length == 0) return;

        var gcmMessage = new gcm.Message({
            data: {
                type: type,
                message: message,
                details: details
            }
        });
        
        var sender = new gcm.Sender(config.apiKey);
        
        sender.send(gcmMessage, { registrationTokens: user.reg_tokens }, function (err, response) {
            if (err) return console.error(err);

            if (response.results) {
                var tokens = myUtil.zip(user.reg_tokens, response.results);
                var addTokens = tokens.filter((token) => token[1].registration_id != null).map((token) => token[1].registration_id);
                var removeTokens = tokens.filter((token) => token[1].registration_id != null || token[1].error != null).map((token) => token[0]);
                user.update({ $addToSet: { reg_tokens: { $each: addTokens } } }, function(err) {
                    if (err) return console.error(err);
                });
                user.update({ $pull: { reg_tokens: { $in: removeTokens } } }, function(err) {
                    if (err) return console.error(err);
                });
            }
        });
    });
};

module.exports = function(uid, type, message, details) {
    save(uid, type, message, details);
    send(uid, type, message, details);
};