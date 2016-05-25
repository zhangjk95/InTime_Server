module.exports = function(order) {
    var currentNumber = order.accept_users.filter((acceptUser) => acceptUser.status != 'canceled').length;
    if (order.number == currentNumber) {
        if (order.accept_users.every((acceptUser) => acceptUser.status == 'canceled' || acceptUser.status == 'completed')) {
            order.status = 'completed';
        }
        else {
            order.status = 'accepted';
        }
    }
    else if (order.status == 'canceling' && order.accept_users.every((acceptUser) => acceptUser.status == 'canceled' || acceptUser.status == 'completed')) {
        order.status = 'canceled';
        
        //TODO: notify
    }
    else {
        order.status = 'waiting';
    }
};