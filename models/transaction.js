var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

module.exports = mongoose.model('transaction', new Schema({
    uid: ObjectId,
    type: String,
    details: Object,
    total: Number
}));