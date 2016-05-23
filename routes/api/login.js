var router = require('express').Router();

var jwt = require('jsonwebtoken');

var config = require(__base + 'config');
var User = require(__base + 'models/user');
var passwordEncrypt = require(__base + "passwordEncrypt");

// POST /login
router.post('/', function(req, res, next) {
    User.findOne({ username: req.body.username }, function(err, user) {
        if (err) return next(err);

        if (!user) {
            res.status(401);
            return res.json({ error: 'Authentication failed. User not found.' });
        }

        if (user.password != passwordEncrypt(req.body.password)) {
            res.status(401);
            return res.json({ error: 'Authentication failed. Wrong password.' });
        }

        var token = jwt.sign({ uid : user._id }, config.tokenSecret, {
            expiresIn: '24h'
        });
        
        return res.json({ uid: user._id, token: token, expiresIn: '24h' });
    });
});

module.exports = router;