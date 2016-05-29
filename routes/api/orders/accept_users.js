var router = require('express').Router();

var util = require('util');
var ObjectId = require('mongoose').Types.ObjectId;

var Order = require(__base + 'models/order');
var User = require(__base + 'models/user');
var modifyStatus = require('./modifyStatus');

// POST /orders/:oid/accept_users/:uid
router.post('/:oid/accept_users/:uid', function(req, res, next) {
    var order = req.dbDoc.order;

    if (req.params.uid != req.user.uid) {
        return res.status(403).json({ error: 'Permission denied.' });
    }
    else if (order.uid == req.user.uid) {
        return res.status(400).json({ error: 'Cannot accept your own order.' });
    }
    else if (order.type == 'notification' || order.status != 'waiting') {
        return res.status(400).json({ error: 'Cannot accept this order.' });
    }

    var acceptUser = order.accept_users.filter((acceptUser) => acceptUser.uid == req.params.uid)[0];

    var addAcceptUser = function() {
        if (acceptUser == null) {
            order.accept_users.push({ uid: ObjectId(req.params.uid), status: 'accepted' });
            modifyStatus(order);
            order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                if (err) return next(err);

                //TODO: notify

                return res.status(201)
                    .header('location', util.format('/orders/%s/accept_users/%s', req.params.oid, req.params.uid))
                    .json({ status: "accepted" });
            });
        }
        else if (acceptUser.status == 'canceled') {
            acceptUser.status = 'accepted';
            modifyStatus(order);
            order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                if (err) return next(err);

                //TODO: notify

                return res.json({ status: "accepted" });
            });
        }
        else {
            return res.status(400).json({ error: 'Order already accepted.' });
        }
    };

    if (order.type == 'offer' && order.points != 0) {
        User.findOneAndUpdate({ _id: ObjectId(req.params.uid), balance: { $gte: order.points } }, { $inc: { balance: -order.points } }, function (err, result) {
            if (err) return next(err);

            if (result) {
                addAcceptUser();
            }
            else {
                return res.status(400).json({ error: 'Insufficient balance.' });
            }
        });
    }
    else {
        addAcceptUser();
    }
});

// PUT /orders/:oid/accept_users/:uid
router.put('/:oid/accept_users/:uid', function(req, res, next) {
    var order = req.dbDoc.order;

    var acceptUser = order.accept_users.filter((acceptUser) => acceptUser.uid == req.params.uid)[0];
    
    if (acceptUser == null) {
        return res.status(400).json({ error: "User not found" });
    }

    if (req.body.status == 'cancel') {
        if (order.uid == req.user.uid) {
            if (order.type == 'request' && acceptUser.status == 'accepted') {
                acceptUser.status = 'canceling';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    //TODO: notify

                    return res.json({ status: "canceling" });
                });
            }
            else if (order.type == 'offer' && (acceptUser.status == 'accepted' || acceptUser.status == 'canceling')) {
                acceptUser.status = 'canceled';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    //TODO: notify

                    if (order.points != 0) {
                        User.update({ _id: ObjectId(acceptUser.uid) }, { $inc: { balance: order.points }}, function(err) {
                            if (err) return next(err);
                            return res.json({ status : 'canceled' });
                        });
                    }
                    else {
                        return res.json({ status: "canceled" });
                    }
                });
            }
            else {
                return res.status(400).json({ error: "Failed to cancel." });
            }
        }
        else if (acceptUser.uid == req.user.uid) {
            if (order.type == 'request' && (acceptUser.status == 'accepted' || acceptUser.status == 'canceling')) {
                acceptUser.status = 'canceled';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    //TODO: notify

                    if (order.status == 'canceled' && order.points != 0) {
                        User.update({ _id: ObjectId(order.uid) }, { $inc: { balance: order.points * order.number }}, function(err) {
                            if (err) return next(err);
                            return res.json({ status : 'canceled' });
                        });
                    }
                    else {
                        return res.json({ status: "canceled" });
                    }
                });
            }
            else if (order.type == 'offer' && acceptUser.status == 'accepted') {
                acceptUser.status = 'canceling';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    //TODO: notify

                    return res.json({ status: "canceling" });
                });
            }
            else {
                return res.status(400).json({ error: "Status cannot be modified." });
            }
        }
        else {
            return res.status(403).json({ error: 'Permission denied.' });
        }
    }
    else if (req.body.status == 'completed') {
        if (acceptUser.uid == req.user.uid && order.type == 'offer') {
            if (acceptUser.status == 'accepted') {
                acceptUser.status = 'completed';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    //TODO: notify

                    if (order.points != 0) {
                        User.update({ _id: ObjectId(order.uid) }, { $inc: { balance: order.points }}, function(err) {
                            if (err) return next(err);
                            return res.json({ status : 'completed' });
                        });
                    }
                    else {
                        return res.json({ status: "completed" });
                    }
                });
            }
            else {
                return res.status(400).json({ error: "Status cannot be modified." });
            }
        }
        else {
            return res.status(403).json({ error: 'Permission denied.' });
        }
    }
    else if (req.body.status == 'accepted') {
        if (acceptUser.uid == req.user.uid) {
            if (acceptUser.status == 'canceling') {
                acceptUser.status = 'accepted';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function (err) {
                    if (err) return next(err);

                    //TODO: notify

                    return res.json({status: "accepted"});
                });
            }
            else {
                return res.status(400).json({ error: "Status cannot be modified." });
            }
        }
        else {
            return res.status(403).json({ error: 'Permission denied.' });
        }
    }
    else {
        return res.status(400).json({ error: "Status error." });
    }
});

module.exports = router;