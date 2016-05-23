var jwt = require('jsonwebtoken');

var config = require(__base + 'config');

module.exports = function(req, res, next) {

    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['x-access-token'];

    // decode token
    if (!token) {
        res.status(401);
        return res.json({ error: 'No token provided.' });
    }

    // verifies secret and checks exp
    jwt.verify(token, config.tokenSecret, function(err, decoded) {
        if (err) {
            res.status(401);
            return res.json({ error: 'Failed to authenticate token.' });
        } else {
            // if everything is good, save to request for use in other routes
            req.user = decoded;
            next();
        }
    });
};