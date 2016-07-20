var router = require('express').Router();

var ObjectId = require('mongoose').Types.ObjectId;

var Template = require(__base + 'models/template');

// POST /templates
router.post('/', function(req, res, next) {
    if (req.body.type != "request" && req.body.type != "offer" && req.body.type != "prompt") {
        return res.status(400).json({ error: 'Type error.' });
    }
    else if (!req.body.title) {
        return res.status(400).json({ error: 'Title is empty.' });
    }

    var template = new Template({
        uid: ObjectId(req.user.uid),
        type: req.body.type,
        title: req.body.title,
        content: req.body.content,
        category: req.body.category,
        points: req.body.points,
        number: req.body.number,
        place: req.body.place,
        coordinate: {
            latitude: req.body.coordinate != null ? req.body.coordinate.latitude : null,
            longitude: req.body.coordinate != null ? req.body.coordinate.longitude : null
        },
        isPrivate: req.body.isPrivate
    });

    template.save(function(err) {
        if (err) return next(err);
        return res.status(201)
            .header("location", "/api/templates/" + template._id)
            .json({ tid: template._id });
    });
});

// GET /templates
router.get('/', function(req, res, next) {
    if (req.query.uid != req.user.uid) {
        return res.status(403).json({ error: 'Permission denied.' });
    }

    Template.find({ uid: req.query.uid }, function(err, templates) {
        if (err) return next(err);
        return res.json({ templates: templates.map((template) => ({
            tid: template._id,
            type: template.type,
            title: template.title,
            content: template.content,
            category: template.category,
            points: template.points,
            number: template.number,
            place: template.place,
            coordinate: template.coordinate,
            isPrivate: template.isPrivate
        }))});
    });
});

//read template from database
router.use('/:tid', function(req, res, next) {
    Template.findOne({ _id: ObjectId(req.params.tid) }).exec(function(err, template) {
        if (err) return next(err);

        if (template == null) {
            return res.status(404).json({error: 'Template not found.'})
        }
        else if (template.uid != req.user.uid) {
            return res.status(403).json({error: 'Permission denied.'});
        }
        else {
            res.locals.template = template;
            next();
        }
    });
});

// GET /templates/:tid
router.get('/:tid', function(req, res, next) {
    var template = res.locals.template;

    return res.json({
        tid: template._id,
        type: template.type,
        title: template.title,
        content: template.content,
        category: template.category,
        points: template.points,
        number: template.number,
        place: template.place,
        coordinate: template.coordinate,
        isPrivate: template.isPrivate
    });
});

// PUT /templates/:tid
router.put('/:tid', function(req, res, next) {
    var template = res.locals.template;

    if (req.body.type != "request" && req.body.type != "offer" && req.body.type != "prompt") {
        return res.status(400).json({ error: 'Type error.' });
    }
    else if (!req.body.title) {
        return res.status(400).json({ error: 'Title is empty.' });
    }

    template.type = req.body.type || template.type;
    template.title = req.body.title || template.title;
    template.content = req.body.content || template.content;
    template.category = req.body.category || template.category;
    template.points = req.body.points || template.points;
    template.number = req.body.number || template.number;
    template.place = req.body.place || template.place;
    template.isPrivate = req.body.isPrivate || template.isPrivate;
    if (req.body.coordinate != null) {
        template.coordinate = {
            latitude: req.body.coordinate.latitude,
            longitude : req.body.coordinate.longitude
        };
    }

    template.save(function(err) {
        if (err) return next(err);
        return res.json({});
    });
});

// DELETE /templates/:tid
router.delete('/:tid', function(req, res, next) {
    var template = res.locals.template;

    template.remove(function(err) {
        if (err) return next(err);
        return res.status(204).end();
    });
});

module.exports = router;