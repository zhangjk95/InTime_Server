var router = require('express').Router();

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
        user.update({ $inc: { balance: increment } }, function(err) {
            if (err) return next(err);
            return res.json({ increment: increment, balance: user.balance + increment });
        });
    }
    else {
        return res.status(400).json({ error: "Invalid promotion code."});
    }
});

module.exports = router;