var router = require('express').Router();

var createTransaction = require(__base + 'transaction').createTransaction;

var validatePromotionCode = function(code) {
    if (code == 'SpectralTiger') {
        return 5000;
    }
    else {
        return 0;
    }
};

router.post('/:uid/balance/promotion/:promotion_code', function(req, res, next) {
    var user = req.dbDoc.user;

    var increment = validatePromotionCode(req.params.promotion_code);
    if (increment > 0) {
        createTransaction(user._id, increment, "balance/promotion")
        .then(function (id) {
            return res.json({ increment: increment, balance: user.balance + increment });
        })
        .catch(function (err) {
            return next(err);
        });
    }
    else {
        return res.status(422).json({ error: "Invalid promotion code."});
    }
});

module.exports = router;