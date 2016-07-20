var request = require('../request');

var router = require('express').Router();

// GET /transactions
router.get('/', function(req, res, next) {
    request(req, res, '/transactions', req.query).then(function (data) {

        data.transactions.forEach(function (transaction) {
            switch (transaction.type.split('/')[0]) {
                case 'order':
                    transaction.href = '/activities/order_detail?oid=' + transaction.details.oid;
                    break;
                default:
                    transaction.href = '/test';
                    break;
            }
        });

        res.render('transactions', data);

    }).catch(function (err) {
        next(err);
    })
});

module.exports = router;