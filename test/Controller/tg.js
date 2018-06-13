var notation  = require('../../lib/Router.js').notation;
var RequestMapping =notation.RequestMapping;
var Service = notation.Service;

@RequestMapping({
    path:"/user/{userId:num}",
    method:"post",
    middleware:['md1',"md2"]
})
class OrderController{

    @Service('service.orderService')
    serviceInst

    @RequestMapping({path:"/order/{type:num}",method:"get"})
    async index(req,res,paras,ctx) {
        this.serviceInst.loadOrders()
    }

    @RequestMapping("/order/{type:num}")
    async index1(req,res,paras,ctx) {
        this.serviceInst.loadOrders()
    }
}

exports.OrderController = OrderController;
