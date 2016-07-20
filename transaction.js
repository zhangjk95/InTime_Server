'use strict';

var ObjectId = require('mongoose').Types.ObjectId;

var config = require('./config');
var User = require(__base + 'models/user');
var Transaction = require(__base + 'models/transaction');

var TransactionError = class {
    constructor(message, details) {
        this.message = message;
        this.details = details;
    }
};

var createTransaction = function (uid, increment, type, details) {
    return User.findOne({ _id: ObjectId(uid), balance: { $gte: -increment } }).exec()
    .then(function (result) {
        if (result) return Promise.resolve();
        else return Promise.reject(new TransactionError('Insufficient balance.'));
    })
    .then(function () {
        var transaction = new Transaction({
            uid: ObjectId(uid),
            type: type,
            details: details,
            total: increment
        });

        return transaction.save();
    })
    .then(function (transaction) {
        return User.findOneAndUpdate(
            { _id: ObjectId(uid), balance: { $gte: -increment } },
            { $inc: { balance: increment }, $push: { transactions: transaction._id } }
        )
        .then(function (result) {
            if (result) return Promise.resolve(transaction._id);
            else return Promise.reject(new TransactionError('Insufficient balance.'));
        });
    });
};

module.exports = {
    TransactionError: TransactionError,
    createTransaction: createTransaction
};