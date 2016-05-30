var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

module.exports = mongoose.model('notification', new Schema({
    uid: ObjectId,
    type: String,
    message: String,
    details: Object,
    read: Boolean
}));