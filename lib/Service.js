/**
 * service注解方法
 * author: lantao.wang
 */
exports.Service =  function Service(){
    if(typeof(arguments[0])!=='function'){
        return function(){
            var a = arguments;
            if(arguments.length===3){
                a[2].writable = true;
            }
        };
    }
};