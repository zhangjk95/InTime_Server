var router = require('express').Router();

var util = require('util');

var User = require(__base + 'models/user');

// GET /users/:uid/friends
router.get('/:uid/friends', function(req, res, next) {
    User.findOne({ _id: req.params.uid }).exec(function(err, user) {
        if (err) return next(err);
        return res.json({ friends: user.friends });
    });
});

// POST /users/:uid/friends/:friend_uid
router.post('/:uid/friends/:friend_uid', function(req, res, next) {
    User.findOne({ _id: req.params.friend_uid }, function(err, friendUser) {
        if (err) return next(err);
        if (friendUser == null) {
            return res.status(400).json({error: 'User does not exist.'})
        }

        User.findOne({ _id: req.params.uid }).exec(function(err, user) {
            if (err) return next(err);

            var friend = user.friends.filter((friend) => friend.uid == req.params.friend_uid)[0];
            if (friend == null) {
                user.update({ $push: { friends: { uid: req.params.friend_uid, status: 'waiting' }}}, function(err) {
                    if (err) return next(err);

                    friendUser.update({ $push: { friends: { uid: req.params.uid, status: 'pending' }}}, function(err) {
                        if (err) return next(err);

                        //TODO: notify

                        return res.status(201)
                            .header('location', util.format('/users/%s/friends/%s', req.params.uid, req.params.friend_uid))
                            .json({ status: "waiting" });
                    });
                });
            }
            else if (friend.status == 'pending') {
                User.update({ _id: req.params.uid, "friends.uid": req.params.friend_uid }, { $set: { "friends.$.status": "accepted" }}, function(err) {
                    if (err) return next(err);

                    User.update({ _id: req.params.friend_uid, "friends.uid": req.params.uid }, { $set: { "friends.$.status": "accepted" }}, function(err) {
                        if (err) return next(err);

                        //TODO: notify

                        return res.json({ status: "accepted" });
                    });
                });
            }
            else if (friend.status == 'waiting') {
                return res.status(400).json({ error: 'Friend request already sent.' });
            }
            else if (friend.status == 'accepted') {
                return res.status(400).json({ error: 'User is already a friend.' });
            }
        });
    });
});

// DELETE /users/:uid/friends/:friend_uid
router.delete('/:uid/friends/:friend_uid', function(req, res, next) {
    User.findOne({ _id: req.params.friend_uid }, function(err, friendUser) {
        if (err) return next(err);
        if (friendUser == null) {
            return res.status(400).json({error: 'User does not exist.'})
        }

        User.findOne({ _id: req.params.uid }).exec(function(err, user) {
            if (err) return next(err);

            var friend = user.friends.filter((friend) => friend.uid == req.params.friend_uid)[0];
            if (friend == null) {
                return res.status(400).json({error: 'User is not a friend yet.'})
            }

            user.update({ $pull: { friends: { uid: req.params.friend_uid }}}, function(err) {
                if (err) return next(err);

                friendUser.update({ $pull: { friends: { uid: req.params.uid }}}, function(err) {
                    if (err) return next(err);

                    return res.status(204).end();
                });
            });
        });
    });
});

module.exports = router;