var router = require('express').Router();

var util = require('util');
var ObjectId = require('mongoose').Types.ObjectId;

var Order = require(__base + 'models/order');
var User = require(__base + 'models/user');
var modifyStatus = require('./modifyStatus');
var sendNotification = require(__base + 'notification');
var createTransaction = require(__base + 'transaction').createTransaction;
var TransactionError = require(__base + 'transaction').TransactionError;

// POST /orders/:oid/accept_users/:uid
router.post('/:oid/accept_users/:uid', function(req, res, next) {
    var order = res.locals.order;

    if (req.params.uid != req.user.uid) {
        return res.status(403).json({ error: 'Permission denied.' });
    }
    else if (order.uid == req.user.uid) {
        return res.status(422).json({ error: 'Cannot accept your own order.' });
    }
    else if (order.type == 'prompt' || order.status != 'waiting') {
        return res.status(422).json({ error: 'Cannot accept this order.' });
    }

    var acceptUser = order.accept_users.filter((acceptUser) => acceptUser.uid == req.params.uid)[0];

    if (acceptUser && acceptUser.status != 'canceled') {
        return res.status(409).json({ error: 'Order already accepted.' });
    }

    new Promise(function (resolve, reject) {
        if (order.type == 'offer') {
            createTransaction(order.uid, -order.points, 'order/accept', {
                oid: order._id,
                points: order.points,
            })
            .then(function () {
                resolve();
            })
            .catch(function (err) {
                if (err instanceof TransactionError) {
                    res.status(403).json({error: 'Insufficient balance.'});
                    reject();
                }
            });
        }
        else {
            resolve();
        }
    })
    .then(function () {
        if (acceptUser == null) {
            order.accept_users.push({ uid: ObjectId(req.params.uid), status: 'accepted' });
            modifyStatus(order);
            order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                if (err) return Promise.reject(err);

                sendNotification(order.uid, 'order', util.format('Someone has accepted your %s.', order.type), { oid: order._id });

                return res.status(201)
                    .header('location', util.format('/orders/%s/accept_users/%s', req.params.oid, req.params.uid))
                    .json({ status: "accepted" });
            });
        }
        else if (acceptUser.status == 'canceled') {
            acceptUser.status = 'accepted';
            modifyStatus(order);
            order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                if (err) return Promise.reject(err);

                sendNotification(order.uid, 'order', util.format('Someone has accepted your %s.', order.type), { oid: order._id });

                return res.json({ status: "accepted" });
            });
        }
    })
    .catch(function (err) {
        if (err) next(err);
    });


});

// PUT /orders/:oid/accept_users/:uid
router.put('/:oid/accept_users/:uid', function(req, res, next) {
    var order = res.locals.order;

    var acceptUser = order.accept_users.filter((acceptUser) => acceptUser.uid == req.params.uid)[0];
    
    if (acceptUser == null) {
        return res.status(404).json({ error: "User not found" });
    }

    if (req.body.status == 'cancel') {
        if (order.uid == req.user.uid) {
            if (order.type == 'request' && acceptUser.status == 'accepted') {
                acceptUser.status = 'canceling';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    sendNotification(acceptUser.uid, 'order', 'Someone wants to cancel the request you accepted.', { oid: order._id });

                    return res.json({ status: "canceling" });
                });
            }
            else if (order.type == 'offer' && (acceptUser.status == 'accepted' || acceptUser.status == 'canceling')) {
                acceptUser.status = 'canceled';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    sendNotification(acceptUser.uid, 'order', 'Someone has canceled the offer you accepted.', { oid: order._id });

                    createTransaction(acceptUser.uid, order.points, 'order/leave', {
                        oid: order._id,
                        points: order.points
                    })
                    .then(function () {
                        res.json({ status : 'canceled' });
                    })
                    .catch(function (err) {
                        next(err);
                    });
                });
            }
            else {
                return res.status(403).json({ error: "Status cannot be modified." });
            }
        }
        else if (acceptUser.uid == req.user.uid) {
            if (order.type == 'request' && (acceptUser.status == 'accepted' || acceptUser.status == 'canceling')) {
                acceptUser.status = 'canceled';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    sendNotification(order.uid, 'order', 'Someone has canceled your request.', { oid: order._id });

                    if (order.status == 'canceled') {
                        createTransaction(order.uid, order.points * order.number, 'order/cancel', {
                            oid: order._id,
                            points: order.points,
                            number: order.number
                        })
                        .then(function () {
                            res.json({ status : 'canceled' });
                        })
                        .catch(function (err) {
                            next(err);
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

                    sendNotification(order.uid, 'order', 'Someone wants to cancel your offer.', { oid: order._id });

                    return res.json({ status: "canceling" });
                });
            }
            else {
                return res.status(403).json({ error: "Status cannot be modified." });
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

                    sendNotification(order.uid, 'order', 'Your offer is completed.', { oid: order._id });

                    createTransaction(order.uid, order.points, 'order/offer_complete', {
                        oid: order._id,
                        points: order.points
                    })
                    .then(function () {
                        res.json({ status : 'completed' });
                    })
                    .catch(function (err) {
                        next(err);
                    });
                });
            }
            else {
                return res.status(403).json({ error: "Status cannot be modified." });
            }
        }
        else {
            return res.status(403).json({ error: 'Permission denied.' });
        }
    }
    else if (req.body.status == 'accepted') {
        if (order.uid == req.user.uid) {
            if (acceptUser.status == 'canceling') {
                acceptUser.status = 'accepted';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function (err) {
                    if (err) return next(err);

                    sendNotification(acceptUser.uid, 'order', 'Someone has denied to cancel the offer you accepted.', { oid: order._id });

                    return res.json({status: "accepted"});
                });
            }
            else {
                return res.status(403).json({ error: "Status cannot be modified." });
            }
        }
        else if (acceptUser.uid == req.user.uid) {
            if (acceptUser.status == 'canceling') {
                acceptUser.status = 'accepted';
                modifyStatus(order);
                order.update({ status: order.status, accept_users: order.accept_users }, function (err) {
                    if (err) return next(err);

                    sendNotification(order.uid, 'order', 'Someone has denied to cancel your request.', { oid: order._id });

                    return res.json({status: "accepted"});
                });
            }
            else {
                return res.status(403).json({ error: "Status cannot be modified." });
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