var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var User = require(__base + 'models/user');
var Template = require(__base + 'models/template');
var Order = require(__base + 'models/order');

// GET /test
router.get('/', function(req, res, next) {

});

module.exports = router;