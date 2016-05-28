var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var Order = require(__base + 'models/order');
var User = require(__base + 'models/user');
var modifyStatus = require('./modifyStatus');

// POST /orders
router.post('/', function(req, res, next) {
    if (!(req.body.type && req.body.title && req.body.content && req.body.category && req.body.coordinate &&
        req.body.coordinate.latitude && req.body.coordinate.longitude && req.body.isPrivate && req.body.time)) {
        return res.status(400).json({error: 'Something is empty.'});
    }
    if (req.body.type != "request" && req.body.type != "offer" && req.body.type != "notification") {
        return res.status(400).json({ error: 'Type error.' });
    }
    if ((req.body.type == "request" || req.body.type == "offer") && isNaN(req.body.points)) {
        return res.status(400).json({ error: 'Points must be an integer.' });
    }
    if ((req.body.type == "request" || req.body.type == "offer") && (isNaN(req.body.number) || parseInt(req.body.number) <= 0)) {
        return res.status(400).json({ error: 'Number must be positive.' });
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
        order.points = req.body.points;
        order.number = req.body.number;
    }

    order.save(function(err) {
        if (err) return next(err);

        //TODO: modify balance

        return res.status(201)
            .header("location", "/api/order/" + order._id)
            .json({ oid: order._id, status: "waiting" });
    });
});

// GET /orders
router.get('/', function(req, res, next) {
    var condition = {};

    if (req.query.uid == req.user.uid || req.query.accept_users_contains == req.user.uid || req.query.status == 'waiting') {
        if (req.query.uid) {
            condition['uid'] = req.query.uid;
        }
        if (req.query.accept_users_contains) {
            condition['accept_users'] = { $elemMatch: { uid: ObjectId(req.query.accept_users_contains) }};
        }
        if (req.query.status) {
            condition['status'] = req.query.status;
            if (req.query.status == 'waiting') {
                condition['time'] = { $gte: new Date() };
            }
        }

        User.findOne({ _id: ObjectId(req.user.uid) }, function (err, user) {
            if (err) return next(err);

            condition['$or'] = [
                { uid: { $in: user.friends.map((friend) => ObjectId(friend.uid)) }, isPrivate: true },
                { uid: ObjectId(req.user.uid), isPrivate: true },
                { isPrivate: false }
            ];

            Order.find(condition, function(err, orders) {
                if (err) return next(err);
                return res.json(orders.map((order) => ({
                    oid: order._id,
                    uid: order.uid,
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
                    accept_users: order.accept_users,
                    status: order.status
                })));
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
            return res.status(400).json({error: 'Order does not exist.'})
        }
        else {
            if (order.isPrivate == false || order.uid == req.user.uid || order.accept_users.some((acceptUser) => acceptUser.uid == req.user.uid)) {
                req.dbDoc.order = order;
                next();
            }
            else {
                User.findOne({ _id: ObjectId(req.user.uid) }, function (err, user) {
                    if (user.friends.some((friend) => friend.uid == order.uid)) {
                        req.dbDoc.order = order;
                        next();
                    }
                    else {
                        return res.status(403).json({ error: 'Permission denied.' });
                    }
                });
            }
        }
    });
});

// GET /orders/:oid
router.get('/:oid', function(req, res, next) {
    var order = req.dbDoc.order;

    return res.json({
        tid: order._id,
        uid: order.uid,
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
        accept_users: order.accept_users,
        status: order.status
    });
});

// PUT /orders/:oid
router.put('/:oid', function(req, res, next) {
    var order = req.dbDoc.order;

    if (order.uid != req.user.uid) {
        return res.status(403).json({ error: 'Permission denied.' });
    }

    if (req.body.status) {
        if (req.body.status == 'cancel' && (order.status == 'waiting' || order.status == 'accepted')) {
            if (order.type == 'offer' || order.type == 'notification' || order.type == 'request' && !order.accept_users.some((acceptUser) => acceptUser.status == 'accepted')) {
                order.status = 'canceled';
                order.save(function(err) {
                    if (err) return next(err);

                    //TODO: modify balance

                    return res.json({ status : 'canceled' });
                });
            }
            else if (order.type == 'request') {
                order.status = 'canceling';
                for (var i in order.accept_users) {
                    var acceptUser = order.accept_users[i];
                    if (acceptUser.status == 'accepted') {
                        acceptUser.status = 'canceling';

                        //TODO: notify
                    }
                }

                order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                    if (err) return next(err);
                    return res.json({ status : 'canceling' });
                });
            }
        }
        else if (req.body.status == 'completed' && order.type == 'request' && order.status == 'accepted') {
            order.status = 'completed';
            for (var i in order.accept_users) {
                var acceptUser = order.accept_users[i];
                if (acceptUser.status == 'accepted') {
                    acceptUser.status = 'completed';

                    //TODO: notify
                }
            }

            order.update({ status: order.status, accept_users: order.accept_users }, function(err) {
                if (err) return next(err);

                //TODO: modify balance

                return res.json({ status : 'completed' });
            });
        }
        else {
            return res.status(400).json({ error: 'Status error.' });
        }
    }
    else {
        if (!(req.body.title && req.body.content && req.body.category && req.body.coordinate &&
            req.body.coordinate.latitude && req.body.coordinate.longitude && req.body.isPrivate && req.body.time)) {
            return res.status(400).json({error: 'Something is empty.'});
        }
        if (req.body.type != "request" && req.body.type != "offer" && req.body.type != "notification") {
            return res.status(400).json({error: 'Type error.'});
        }
        if ((req.body.type == "request" || req.body.type == "offer") && isNaN(req.body.points)) {
            return res.status(400).json({error: 'Points must be an integer.'});
        }
        if ((req.body.type == "request" || req.body.type == "offer") && (isNaN(req.body.number) || parseInt(req.body.number) <= 0)) {
            return res.status(400).json({error: 'Number must be positive.'});
        }

        order.isPrivate = req.body.isPrivate;
        if (req.body.type == "request" || req.body.type == "offer") {
            var currentNumber = order.accept_users.filter((acceptUser) => acceptUser.status != 'canceled').length;
            if (req.body.number < currentNumber) {
                return res.status(400).json({error: "Number must greater or equal than number of accepted users."});
            }
            else {
                order.number = req.body.number;
                modifyStatus(order);
            }
        }

        if (!order.accept_users.some((acceptUser) => acceptUser.status != 'canceled')) {
            order.title = req.body.title;
            order.content = req.body.content;
            order.category = req.body.category;
            order.place = req.body.place;
            order.coordinate = {
                latitude: req.body.coordinate.latitude,
                longitude: req.body.coordinate.longitude
            };
            order.time = req.body.time;

            if (req.body.type == "request" || req.body.type == "offer") {
                order.points = req.body.points;
            }
        }

        order.save(function (err) {
            if (err) return next(err);

            //TODO: modify balance

            return res.json({});
        });
    }
});

router.use(require('./accept_users'));

module.exports = router;