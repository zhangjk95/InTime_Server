var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

module.exports = mongoose.model('order', new Schema({
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
    isPrivate: Boolean,
    time: Date,
    accept_users: Array,
    status: String
}));