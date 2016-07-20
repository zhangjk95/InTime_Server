var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var Transaction = require(__base + 'models/transaction');

// GET /transactions
router.get('/', function(req, res, next) {
    Transaction.aggregate([
        { $match: { uid: ObjectId(req.user.uid) } },
        { $lookup: { from: "orders", localField: "details.oid", foreignField: "_id", as: "order" }},
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } }
    ], function(err, transactions) {
        if (err) return next(err);

        return res.json({ transactions: transactions.map((transaction) => ({
            trid: transaction._id,
            type: transaction.type,
            total: transaction.total,
            details: transaction.details,
            order: transaction.order
        })) });
    });
});

module.exports = router;