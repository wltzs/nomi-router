var notation  = require('../../lib/Router.js').notation;
var Service = notation.Service;

@Service("service.orderService")
class OrderService{
    async loadOrders() {
        console.log(this.test());
    }
    test(){
        console.log("this is the function test of OrderService which is invoked by loadOrders function");
    }
}

exports.OrderService = OrderService;