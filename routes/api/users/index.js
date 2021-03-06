var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var User = require(__base + 'models/user');
var passwordEncrypt = require(__base + "passwordEncrypt");

// POST /users
router.post('/', function(req, res, next) {
    if (!req.body.username) {
        return res.status(400).json({ error: 'Username is empty.' });
    }
    else if (!req.body.password) {
        return res.status(400).json({ error: 'Password is empty.' });
    }
    else if (!req.body.phone) {
        return res.status(400).json({ error: 'Phone is empty.' });
    }

    User.findOne({username: req.body.username}).exec(function(err, result) {
        if (err) return next(err);
        if (result) {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        else {
            var user = new User({
                username: req.body.username,
                password: passwordEncrypt(req.body.password),
                phone: req.body.phone,
                email: req.body.email,
                balance: 0,
                friends: []
            });

            user.save(function(err) {
                if (err) return next(err);
                return res.status(201)
                    .header("location", "/api/users/" + user._id)
                    .json({ uid: user._id });
            });
        }
    });
});

router.use(require('../verifyToken'));

// GET /users
router.get('/', function(req, res, next) {
    User.find({ username: {$regex: req.query.username_like, $options: 'i'} }, function(err, users) {
        if (err) return next(err);
        return res.json({ users: users.filter((user) => user._id != req.user.uid).map((user) => ({ uid: user._id, username: user.username })) });
    });
});

//Read user from database
router.use('/:uid', function(req, res, next) {
    User.findOne({ _id: ObjectId(req.params.uid) }, function(err, user) {
        if (err) return next(err);
        if (user == null) {
            return res.status(404).json({ error: 'User does not exist.' })
        }
        else {
            res.locals.user = user;
            next();
        }
    });
});

// GET /users/:uid
router.get('/:uid', function(req, res, next) {
    var user = res.locals.user;
    
    if (req.user && req.params.uid == req.user.uid) {
        return res.json({ username: user.username, phone: user.phone, email: user.email, balance: user.balance });
    }
    else {
        User.findOne({ _id: req.user.uid }, function (err, requestUser) {
            var friend = requestUser.friends.filter((friend) => friend.uid == req.params.uid)[0];
            return res.json({ username: user.username, phone: user.phone, email: user.email, status: friend != null ? friend.status : "none" });
        });
    }
});

router.use('/:uid', require('./verifyUserPermission'));

// PUT /users/:uid
router.put('/:uid', function(req, res, next) {
    var user = res.locals.user;
    
    if (!req.body.username) {
        return res.status(400).json({ error: 'Username is empty.' });
    }
    else if (!req.body.phone) {
        return res.status(400).json({ error: 'Phone is empty.' });
    }

    User.findOne({username: req.body.username}).exec(function(err, result) {
        if (err) return next(err);
        if (result && result._id != req.user.uid) {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        else {
            user.username = req.body.username;
            user.phone = req.body.phone;
            user.email = req.body.email;

            if (req.body.password) {
                if (!req.body.oldPassword) {
                    return res.status(400).json({ error: 'Old password is empty.' });
                }
                else if (passwordEncrypt(req.body.oldPassword) != user.password) {
                    return res.status(403).json({ error: 'Wrong old password.' });
                }
                else {
                    user.password = passwordEncrypt(req.body.password);
                }
            }

            user.save(function(err) {
                if (err) return next(err);
                return res.json({});
            });
        }
    });
});

router.use(require('./friends'));
router.use(require('./balance'));
router.use(require('./reg_tokens'));

module.exports = router;