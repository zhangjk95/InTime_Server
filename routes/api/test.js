var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var User = require(__base + 'models/user');

// GET /test
router.get('/', function(req, res, next) {

});

module.exports = router;