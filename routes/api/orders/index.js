var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var Order = require(__base + 'models/order');
var User = require(__base + 'models/user');
var modifyStatus = require('./modifyStatus');
var sendNotification = require(__base + 'notification');
var createTransaction = require(__base + 'transaction').createTransaction;
var TransactionError = require(__base + 'transaction').TransactionError;

// POST /orders
router.post('/', function(req, res, next) {
    if (!(req.body.type && req.body.title && req.body.content && req.body.category && req.body.coordinate &&
        req.body.coordinate.latitude && req.body.coordinate.longitude && req.body.time)) {
        return res.status(400).json({error: 'Something is empty.'});
    }
    if (req.body.type != "request" && req.body.type != "offer" && req.body.type != "prompt") {
        return res.status(400).json({ error: 'Type error.' });
    }
    if ((req.body.type == "request" || req.body.type == "offer") && (isNaN(req.body.points) || parseInt(req.body.points) < 0)) {
        return res.status(400).json({ error: 'Points must be a non-negative integer.' });
    }
    if ((req.body.type == "request" || req.body.type == "offer") && (isNaN(req.body.number) || parseInt(req.body.number) <= 0)) {
        return res.status(400).json({ error: 'Number must be a positive integer.' });
    }
    if (typeof(req.body.isPrivate) !== "boolean") {
        return res.status(400).json({ error: 'Type of "isPrivate" must be boolean.' });
    }

    var order = new Order({
        uid: ObjectId(req.user.uid),
        type: req.body.type,
        title: req.body.title,
        content: req.body.content,
        category: req.body.category,
        place: req.body.place,
        coordinate: {
            latitude: req.body.coordinate.latitude,
            longitude: req.body.coordinate.longitude
        },
        isPrivate: req.body.isPrivate,
        time: req.body.time,
        accept_users: [],
        status: "waiting"
    });

    if (req.body.type == "request" || req.body.type == "offer") {
        order.points = parseInt(req.body.points);
        order.number = parseInt(req.body.number);
    }

    new Promise(function (resolve, reject) {
        if (order.type == "request") {
            var decrement = order.points * order.number;

            createTransaction(order.uid, -decrement, 'order/create', {
                oid: order._id,
                points: order.points,
                number: order.number
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
        return order.save();
    })
    .then(function () {
        res.status(201)
            .header("location", "/api/order/" + order._id)
            .json({oid: order._id, status: "waiting"});
    })
    .catch(function (err) {
        if (err) next(err);
    });
});

// GET /orders
router.get('/', function(req, res, next) {
    var condition = {};

    if (req.query.uid == req.user.uid || req.query.accept_users_contains == req.user.uid || (req.query.status == 'waiting' && req.query.time_gte_now == 'true')) {
        if (req.query.uid) {
            condition['uid'] = ObjectId(req.query.uid);
        }
        if (req.query.accept_users_contains) {
            condition['accept_users'] = { $elemMatch: { uid: ObjectId(req.query.accept_users_contains), status: { $ne: "canceled" } }};
        }
        if (req.query.status) {
            condition['status'] = { $regex: req.query.status };
        }
        if (req.query.time_gte_now == 'true') {
            condition['time'] = { $gte: new Date() };
        }
        if (req.query.title_or_content_like) {
            condition['$and'] = req.query.title_or_content_like.split(/\s+/).map((keyword) => ({ $or: [
                { title: { $regex: keyword, $options: 'i' } },
                { content: { $regex: keyword, $options: 'i' } }
            ]}));
        }

        User.findOne({ _id: ObjectId(req.user.uid) }, function (err, user) {
            if (err) return next(err);

            condition['$or'] = [
                { uid: { $in: user.friends.filter((friend) => friend.status == 'accepted').map((friend) => ObjectId(friend.uid)) }, isPrivate: true },
                { uid: ObjectId(req.user.uid), isPrivate: true },
                { isPrivate: false }
            ];

            Order.aggregate([
                { $match: condition },
                { $lookup: { from: "users", localField: "uid", foreignField: "_id", as: "userInfo" }},
                { $unwind: '$userInfo' },
                { $project: {
                    _id: false,
                    oid: "$_id",
                    uid: true,
                    username: "$userInfo.username",
                    type: true,
                    title: true,
                    content: true,
                    category: true,
                    points: true,
                    number: true,
                    place: true,
                    coordinate: true,
                    isPrivate: true,
                    time: true,
                    accept_users: true,
                    status: true
                }}
            ], function(err, orders) {
                if (err) return next(err);
                return res.json({ orders: orders });
            })
        });
    }
    else {
        return res.status(403).json({ error: 'Permission denied.' });
    }
});

//read order from database
router.use('/:oid', function(req, res, next) {
    Order.findOne({ _id: ObjectId(req.params.oid) }).exec(function(err, order) {
        if (err) return next(err);

        if (order == null) {
            return res.status(404).json({error: 'Order not found.'})
        }
        else {
            User.findOne({ _id: ObjectId(order.uid) }, function (err, user) {
                if (order.isPrivate == false || order.uid == req.user.uid || order.accept_users.some((acceptUser) => acceptUser.uid == req.user.uid)
                    || user.friends.some((friend) => friend.uid.equals(req.user.uid) && friend.status == "accepted"))
                {
                    order.username = user.username;
                    res.locals.order = order;
                    next();
                }
                else {
                    return res.status(403).json({ error: 'Permission denied.' });
                }
            });
        }
    });
});

// GET /orders/:oid
router.get('/:oid', function(req, res, next) {
    var order = res.locals.order;

    Order.aggregate([
        { $match: { _id: ObjectId(req.params.oid) } },
        { $unwind: '$accept_users' },
        { $lookup: { from: "users", localField: "accept_users.uid", foreignField: "_id", as: "userInfo" }},
        { $unwind: '$userInfo' },
        { $project: { _id: false, uid: "$userInfo._id", username: "$userInfo.username", status: "$accept_users.status" }}
    ], function (err, accept_users) {
        if (err) return next(err);

        return res.json({
            tid: order._id,
            uid: order.uid,
            username: order.username,
            type: order.type,
            title: order.title,
            content: order.content,
            category: order.category,
            points: order.points,
            number: order.number,
            place: order.place,
            coordinate: order.coordinate,
            isPrivate: order.isPrivate,
            time: order.time,
            accept_users: accept_users,
            status: order.status
        });
    });
});

// PUT /orders/:oid
router.put('/:oid', function(req, res, next) {
    var order = res.locals.order;

    if (order.uid != req.user.uid) {
        return res.status(403).json({ error: 'Permission denied.' });
    }

    if (req.body.status) {
        var acceptUsers = order.accept_users.filter((acceptUser) => acceptUser.status == 'accepted' || acceptUser.status == 'canceling');

        if (req.body.status == 'cancel' && (order.status == 'waiting' || order.status == 'accepted')) {
            if (order.type == 'offer' || order.type == 'prompt' || order.type == 'request' && !order.accept_users.some((acceptUser) => acceptUser.status == 'accepted' || acceptUser.status == 'canceling')) {
                order.status = 'canceled';

                acceptUsers.forEach((acceptUser) => {
                    acceptUser.status = 'canceled';
                    sendNotification(acceptUser.uid, 'order', 'Someone has canceled the order you accepted.', { oid: order._id });
                });

                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);

                    if (order.type == 'request') {
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
                    else if (order.type == 'offer') {
                        Promise.all(
                            acceptUsers.map((acceptUser) => createTransaction(acceptUser.uid, order.points, 'order/leave', {
                                oid: order._id,
                                points: order.points
                            }))
                        )
                        .then(function () {
                            res.json({ status : 'canceled' });
                        })
                        .catch(function (err) {
                            next(err);
                        });
                    }
                    else {
                        return res.json({ status : 'canceled' });
                    }
                });
            }
            else if (order.type == 'request') {
                order.status = 'canceling';
                acceptUsers.forEach((acceptUser) => {
                    acceptUser.status = 'canceling';
                    sendNotification(acceptUser.uid, 'order', 'Someone wants to cancel the request you accepted.', { oid: order._id });
                });

                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);
                    return res.json({ status : 'canceling' });
                });
            }
        }
        else if (req.body.status == 'completed' && order.type == 'request' && order.status == 'accepted') {
            order.status = 'completed';
            acceptUsers.forEach((acceptUser) => {
                acceptUser.status = 'completed';
                sendNotification(acceptUser.uid, 'order', 'The request you accepted is completed.', { oid: order._id });
            });

            order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                if (err) return next(err);

                Promise.all(
                    acceptUsers.map((acceptUser) => createTransaction(acceptUser.uid, order.points, 'order/request_complete', {
                        oid: order._id,
                        points: order.points
                    }))
                )
                .then(function () {
                    res.json({ status : 'completed' });
                })
                .catch(function (err) {
                    next(err);
                });
            });
        }
        else {
            return res.status(400).json({ error: 'Status error.' });
        }
    }
    else {
        if (!(req.body.title && req.body.content && req.body.category && req.body.coordinate &&
            req.body.coordinate.latitude && req.body.coordinate.longitude && req.body.time)) {
            return res.status(400).json({error: 'Something is empty.'});
        }
        if ((order.type == "request" || order.type == "offer") && (isNaN(req.body.points) || parseInt(req.body.points) < 0)) {
            return res.status(400).json({ error: 'Points must be a non-negative integer.' });
        }
        if ((order.type == "request" || order.type == "offer") && (isNaN(req.body.number) || parseInt(req.body.number) <= 0)) {
            return res.status(400).json({ error: 'Number must be a positive integer.' });
        }
        if (typeof(req.body.isPrivate) !== "boolean") {
            return res.status(400).json({ error: 'Type of "isPrivate" must be boolean.' });
        }

        var origPoints = order.points * order.number;
        var acceptUsers = order.accept_users.filter((acceptUser) => acceptUser.status != 'canceled');

        order.time = req.body.time;
        order.isPrivate = req.body.isPrivate;

        if (order.type == "request" || order.type == "offer") {
            if (req.body.number < acceptUsers.length) {
                return res.status(422).json({error: "Number must greater or equal than number of accepted users."});
            }
            else {
                order.number = req.body.number;
                modifyStatus(order);
            }
        }

        if (acceptUsers.length == 0) {
            order.title = req.body.title;
            order.content = req.body.content;
            order.category = req.body.category;
            order.place = req.body.place;
            order.coordinate = {
                latitude: req.body.coordinate.latitude,
                longitude: req.body.coordinate.longitude
            };

            if (order.type == "request" || order.type == "offer") {
                order.points = req.body.points;
            }
        }

        var delta = order.points * order.number - origPoints;

        new Promise(function (resolve, reject) {
            if (order.type == "request") {
                createTransaction(order.uid, -delta, 'order/modify', {
                    oid: order._id,
                    points: order.points,
                    number: order.number
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
            return order.save();
        })
        .then(function () {
            return res.json({});
        })
        .catch(function (err) {
            if (err) next(err);
        });
    }
});

router.use(require('./accept_users'));

module.exports = router;