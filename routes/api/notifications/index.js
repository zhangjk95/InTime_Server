var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var Notification = require(__base + 'models/notification');

// GET /notifications
router.get('/', function(req, res, next) {
    Notification.find({ uid: ObjectId(req.user.uid) }, function(err, notifications) {
        if (err) return next(err);

        return res.json({ notifications: notifications.map((notification) => ({
            nid: notification._id,
            type: notification.type,
            message: notification.message,
            details: notification.details,
            read: notification.read
        })) });
    });
});

// PUT /notifications/all
router.put('/all', function(req, res, next) {
    if (!(req.body.read instanceof Boolean)) {
        return res.status(400).json({ error: 'Type of "read" must be boolean.' });
    }

    Notification.update({ uid: ObjectId(req.user.uid) }, { read: req.body.read }, function(err) {
        if (err) return next(err);
        return res.json({});
    });
});

// PUT /notifications/:nid
router.put('/:nid', function(req, res, next) {
    if (typeof(req.body.read) !== "boolean") {
        return res.status(400).json({ error: 'Type of "read" must be boolean.' });
    }

    Notification.update({ _id: ObjectId(req.params.nid), uid: ObjectId(req.user.uid) }, { read: req.body.read }, function (err, result) {
        if (err) return next(err);

        if (result) {
            return res.json({});
        }
        else {
            return res.status(404).json({ error: 'Notification not found.' });
        }
    });
});

module.exports = router;