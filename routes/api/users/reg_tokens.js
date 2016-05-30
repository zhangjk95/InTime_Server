var router = require('express').Router();

var util = require('util');
var ObjectId = require('mongoose').Types.ObjectId;

var User = require(__base + 'models/user');

// POST /users/:uid/reg_tokens/:reg_token
router.post('/:uid/reg_tokens/:reg_token', function(req, res, next) {
    var user = req.dbDoc.user;

    user.update({ $push: { reg_tokens: req.params.reg_token }}, function(err) {
        if (err) return next(err);
        return res.status(201)
            .header('location', util.format('/users/%s/reg_tokens/%s', req.params.uid, req.params.reg_token))
            .json({});
    });
});

// DELETE /users/:uid/reg_tokens/:reg_token
router.delete('/:uid/reg_tokens/:reg_token', function(req, res, next) {
    User.findOneAndUpdate({ _id: ObjectId(req.params.uid), reg_tokens: req.params.reg_token }, { $pull: { reg_tokens: req.params.reg_token }}, function(err, result) {
        if (err) return next(err);

        if (!result) {
            return res.status(404).json({ error: 'Register token not found.' })
        }
        else {
            return res.status(204).end();
        }
    });
});

module.exports = router;