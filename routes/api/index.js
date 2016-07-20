var router = require('express').Router();

router.use('/users', require('./users'));
router.use('/login', require('./login'));

if (__env === 'development') {
    router.use('/test', require('./test'));
}

router.use(require('./verifyToken'));

router.use('/orders', require('./orders'));
router.use('/templates', require('./templates'));
router.use('/notifications', require('./notifications'));
router.use('/transactions', require('./transactions'));

module.exports = router;