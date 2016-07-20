var request = require('../request');

var router = require('express').Router();

// GET /transactions
router.get('/', function(req, res, next) {
    request(req, res, '/transactions', req.query).then(function (data) {
        res.render('transactions', data);
    }).catch(function (err) {
        next(err);
    })
});

module.exports = router;