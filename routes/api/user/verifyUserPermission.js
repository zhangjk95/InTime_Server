module.exports = function(req, res, next) {
    if (req.params.uid != req.user.uid) {
        return res.status(403).json({ error: 'Permission denied.' });
    }

    next();
};