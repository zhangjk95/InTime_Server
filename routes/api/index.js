var router = require('express').Router();

router.use('/user', require('./user'));
router.use('/login', require('./login'));

if (__env === 'development') {
    router.use('/test', require('./test'));
}

router.use(require('./verifyToken'));

module.exports = router;