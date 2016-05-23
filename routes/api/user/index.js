var router = require('express').Router();

var User = require(__base + 'models/user');
var passwordEncrypt = require(__base + "passwordEncrypt");

// POST /user
router.post('/', function(req, res, next) {
    if (req.body.username == null) {
        return res.status(400).json({ error: 'Username is empty.' });
    }
    else if (req.body.password == null) {
        return res.status(400).json({ error: 'Password is empty.' });
    }
    else if (req.body.phone == null) {
        return res.status(400).json({ error: 'Phone is empty.' });
    }

    User.findOne({username: req.body.username}).exec(function(err, result) {
        if (err) return next(err);
        if (result) {
            return res.status(400).json({ error: 'Username already exists.' });
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
                    .header("location", "/api/user/" + user._id)
                    .json({ uid: user._id });
            });
        }
    });
});

router.use(require('../verifyToken'));

// GET /user
router.get('/', function(req, res, next) {
    User.find({ username: {$regex: req.query.username_like, $options: 'i'} }, function(err, users) {
        if (err) return next(err);
        return res.json(users.map((user) => ({ uid: user._id, username: user.username })));
    });
});

// GET /user/:uid
router.get('/:uid', function(req, res, next) {
    User.findOne({ _id: req.params.uid }, function(err, user) {
        if (err) return next(err);
        if (user == null) {
            return res.status(400).json({ error: 'User does not exist.' })
        }
        else {
            if (req.user && req.params.uid == req.user.uid) {
                return res.json({ username: user.username, phone: user.phone, email: user.email, balance: user.balance / 100 });
            }
            else {
                return res.json({ username: user.username, phone: user.phone, email: user.email });
            }
        }
    });
});

router.use('/:uid', require('./verifyUserPermission'));

// PUT /user/:uid
router.put('/:uid', function(req, res, next) {
    if (req.body.username == null) {
        return res.status(400).json({ error: 'Username is empty.' });
    }
    else if (req.body.phone == null) {
        return res.status(400).json({ error: 'Phone is empty.' });
    }

    User.findOne({ _id: req.params.uid }).exec(function(err, user) {
        if (err) return next(err);

        user.username = req.body.username;
        user.phone = req.body.phone;
        user.email = req.body.email;

        if (req.body.password) {
            if (req.body.oldPassword == null) {
                return res.status(400).json({ error: 'Old password is empty.' });
            }
            else if (passwordEncrypt(req.body.oldPassword) != user.password) {
                return res.status(400).json({ error: 'Wrong old password.' });
            }
            else {
                user.password = passwordEncrypt(req.body.password);
            }
        }

        user.save(function(err) {
            if (err) return next(err);
            return res.json({});
        });
    });
});

router.use(require('./friends'));

module.exports = router;