import Router from  "../lib/Router.js";

async function test(){
    var router = await Router.init({
        controllerPath:["/Controller/"],
        servicePath:["/services/"]
    });

    //console.log(router.match('/user/12/order/12345?p1=2333==&p2=ddddd','POST'));
    router.match('/user/12/order/12345?p3=2333==&p4=ddddd','Get').action.act("dd:ddddddddddddddd");

}

test();