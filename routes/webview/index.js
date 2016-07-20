var router = require('express').Router();

router.use('/transactions', require('./transactions'));

module.exports = router;