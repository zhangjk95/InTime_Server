var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

module.exports = mongoose.model('template', new Schema({
    uid: ObjectId,
    type: String,
    title: String,
    content: String,
    category: String,
    points: Number,
    number: Number,
    place: String,
    coordinate: {
        latitude: Number,
        longitude: Number
    },
    isPrivate: Boolean
}));