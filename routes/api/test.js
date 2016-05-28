var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var User = require(__base + 'models/user');

// GET /test
router.get('/', function(req, res, next) {
    User.find({}, function(err, users) {
        if (err) return next(err);

        for (var j in users) {
            var user = users[j];

            for (var i in user.friends) {
                user.friends[i].uid = ObjectId(user.friends[i].uid);
            }
            user.update({ friends: user.friends }, function (err) {
                if (err) return next(err);
            })
        }
    });
});

module.exports = router;