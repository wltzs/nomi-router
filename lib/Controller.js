/**
 * 控制器注解方法
 * author: lantao.wang
 */

exports.RequestMapping =  function RequestMapping(){
    if(typeof(arguments[0])!=='function'){
        return function(){};
    }

};