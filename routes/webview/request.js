var request = require('request');
var url = require('url');
var _ = require('lodash');

var urlPrefix = 'http://localhost:3000/api';

module.exports = function (req, res, requestUrl, query) {
    var urlObj = url.parse(urlPrefix + requestUrl, true);
    _.extend(urlObj.query, query);

    return new Promise(function (resolve, reject) {
        request({
            url: url.format(urlObj),
            headers: {
                'x-access-token': req.headers['x-access-token']
            }
        }, function (err, response, body) {
            if (err) return reject(err);

            var data = JSON.parse(body);

            if (response.statusCode !== 200) {
                reject({
                    status: response.statusCode,
                    message: data.error,
                    stack: data.stacktrace
                });
            }
            else {
                resolve(data);
            }
        });
    });
};