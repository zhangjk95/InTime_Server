var router = require('express').Router();

router.use('/users', require('./users'));
router.use('/login', require('./login'));

if (__env === 'development') {
    router.use('/test', require('./test'));
}

router.use(require('./verifyToken'));

module.exports = router;