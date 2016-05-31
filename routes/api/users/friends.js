var router = require('express').Router();

var util = require('util');
var ObjectId = require('mongoose').Types.ObjectId;

var User = require(__base + 'models/user');
var sendNotification = require(__base + 'notification');

// GET /users/:uid/friends
router.get('/:uid/friends', function(req, res, next) {
    User.aggregate([
        { $match: { _id: ObjectId(req.params.uid) }},
        { $unwind: '$friends' },
        { $project: { _id: false, friends: true } },
        { $lookup: { from: "users", localField: "friends.uid", foreignField: "_id", as: "userInfo" }},
        { $unwind: '$userInfo' },
        { $project: { uid: "$friends.uid", status: "$friends.status", username: "$userInfo.username" }}
    ], function(err, data) {
        if (err) return next(err);
        return res.json({ friends: data });
    });
});

//Read friend user from database
router.use('/:uid/friends/:friend_uid', function(req, res, next) {
    User.findOne({ _id: ObjectId(req.params.friend_uid) }, function(err, friendUser) {
        if (err) return next(err);
        if (friendUser == null) {
            return res.status(422).json({ error: 'Friend user does not exist.' })
        }
        else {
            req.dbDoc.friendUser = friendUser;
            next();
        }
    });
});

// POST /users/:uid/friends/:friend_uid
router.post('/:uid/friends/:friend_uid', function(req, res, next) {
    var user = req.dbDoc.user;
    var friendUser = req.dbDoc.friendUser;

    var friend = user.friends.filter((friend) => friend.uid == req.params.friend_uid)[0];
    if (friend == null) {
        user.update({ $push: { friends: { uid: ObjectId(req.params.friend_uid), status: 'waiting' }}}, function(err) {
            if (err) return next(err);

            friendUser.update({ $push: { friends: { uid: ObjectId(req.params.uid), status: 'pending' }}}, function(err) {
                if (err) return next(err);

                sendNotification(friendUser.uid, 'friend', 'You have received a friend request.', { uid: user._id });

                return res.status(201)
                    .header('location', util.format('/users/%s/friends/%s', req.params.uid, req.params.friend_uid))
                    .json({ status: "waiting" });
            });
        });
    }
    else if (friend.status == 'pending') {
        User.update({ _id: ObjectId(req.params.uid), "friends.uid": ObjectId(req.params.friend_uid) }, { $set: { "friends.$.status": "accepted" }}, function(err) {
            if (err) return next(err);

            User.update({ _id: ObjectId(req.params.friend_uid), "friends.uid": ObjectId(req.params.uid) }, { $set: { "friends.$.status": "accepted" }}, function(err) {
                if (err) return next(err);

                sendNotification(friendUser.uid, 'friend', 'Your friend request is accepted.', { uid: user._id });

                return res.json({ status: "accepted" });
            });
        });
    }
    else if (friend.status == 'waiting') {
        return res.status(409).json({ error: 'Friend request already sent.' });
    }
    else if (friend.status == 'accepted') {
        return res.status(409).json({ error: 'User is already a friend.' });
    }
});

// DELETE /users/:uid/friends/:friend_uid
router.delete('/:uid/friends/:friend_uid', function(req, res, next) {
    var user = req.dbDoc.user;
    var friendUser = req.dbDoc.friendUser;

    var friend = user.friends.filter((friend) => friend.uid == req.params.friend_uid)[0];
    if (friend == null) {
        return res.status(404).json({error: 'User is not a friend yet.'})
    }

    user.update({ $pull: { friends: { uid: ObjectId(req.params.friend_uid) }}}, function(err) {
        if (err) return next(err);

        friendUser.update({ $pull: { friends: { uid: ObjectId(req.params.uid) }}}, function(err) {
            if (err) return next(err);

            return res.status(204).end();
        });
    });
});

module.exports = router;