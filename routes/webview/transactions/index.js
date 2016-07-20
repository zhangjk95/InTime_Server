var dateFormat = require('dateformat');
var request = require('../request');

var router = require('express').Router();

// GET /transactions
router.get('/', function(req, res, next) {
    request(req, res, '/transactions', req.query).then(function (data) {

        data.transactions.sort((a, b) => b.trid.localeCompare(a.trid)).forEach(function (transaction) {
            switch (transaction.type.split('/')[0]) {
                case 'order':
                    transaction.href = '/activities/order_detail?oid=' + transaction.details.oid;
                    transaction.title = transaction.order.title;
                    break;
                default:
                    transaction.href = 'javascript:;';
                    transaction.title = '';
                    break;
            }

            switch (transaction.type) {
                case 'balance/promotion':
                    transaction.icon = 'ic-promotion';
                    break;
                case 'order/create':
                    transaction.icon = 'ic-tag-red';
                    break;
                case 'order/modify':
                    transaction.icon = 'ic-tag-red';
                    break;
                case 'order/cancel':
                    transaction.icon = 'ic-tag-red';
                    break;
                case 'order/request_complete':
                    transaction.icon = 'ic-tag-red';
                    break;
                case 'order/accept':
                    transaction.icon = 'ic-tag-green';
                    break;
                case 'order/leave':
                    transaction.icon = 'ic-tag-green';
                    break;
                case 'order/offer_complete':
                    transaction.icon = 'ic-tag-green';
                    break;
            }

            switch (transaction.type) {
                case 'order/create':
                    transaction.smallIcon = 'ic-create';
                    break;
                case 'order/modify':
                    transaction.smallIcon = 'ic-modify';
                    break;
                case 'order/cancel':
                    transaction.smallIcon = 'ic-cancel';
                    break;
                case 'order/request_complete':
                    transaction.smallIcon = 'ic-complete';
                    break;
                case 'order/accept':
                    transaction.smallIcon = 'ic-create';
                    break;
                case 'order/leave':
                    transaction.smallIcon = 'ic-cancel';
                    break;
                case 'order/offer_complete':
                    transaction.smallIcon = 'ic-complete';
                    break;
            }

            transaction.typeText = transaction.type.split('/')[1];
            switch (transaction.typeText) {
                case 'offer_complete':
                case 'request_complete':
                    transaction.typeText = 'complete';
                    break;
            }

            transaction.date = new Date(parseInt(transaction.trid.substring(0, 8), 16) * 1000);
            transaction.dateText = dateFormat(transaction.date, 'yyyy-mm-dd HH:MM:ss');


        });

        res.render('transactions', data);

    }).catch(function (err) {
        next(err);
    })
});

module.exports = router;