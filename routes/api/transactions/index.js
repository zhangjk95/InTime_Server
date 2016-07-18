var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var Transaction = require(__base + 'models/transaction');

// GET /transactions
router.get('/', function(req, res, next) {
    Transaction.find({ uid: ObjectId(req.user.uid) }, function(err, transactions) {
        if (err) return next(err);

        return res.json({ transactions: transactions.map((transaction) => ({
            trid: transaction._id,
            type: transaction.type,
            total: transaction.total,
            details: transaction.details
        })) });
    });
});

module.exports = router;