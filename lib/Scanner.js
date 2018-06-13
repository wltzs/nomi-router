/**
 * controller和service扫描模块，扫描指定目录下controller和service并组装
 * author: lantao.wang
 */

require('babel-register')({plugins: ['transform-decorators-legacy']});

var fs = require('fs'),
    parser = require('./parser.js'),
    path = require('path');


function each(a,cb){
    a = a||[];
    for(var i=0,l=a.length;i<l;i++){
        if(cb(a[i],i)===false){
            return ;
        }
    }
}

function type(o){
    return Object.prototype.toString.apply(o);
}

function isArray(o){
    return type(o)==='[object Array]';
}

function toArray(s){
    return isArray(s)?s:[s];
}

function parsePaire(tk){
    var t = tk.peek(),res = {key:t.t};
    tk.next();
    t = tk.peek();
    if(t.t===':'){
        tk.next();
    }
    res.val = parseObject(tk);
    return res;
}

//skiop certain token
function skip(c,tk){
    var t = tk.peek();
    if(t.t===c){
        tk.next();
    }
}

//parse list
function parseLst(start,end,sMark,parser,tk) {
    var a = [];
    skip(start,tk);
    while (!tk.eof()) {
        var cur = tk.peek();
        if (cur.t === end){
            tk.next();
            break;
        }
        skip(sMark,tk);
        cur = tk.peek();
        if (cur.t === end){
            tk.next();
            break;
        }
        a.push(parser(tk));
    }
    return a;
}

//parse js object in the noation parameters
function parseObject(tk){
    var t = tk.peek();
    if(t.type==="string"||t.type==="id"||t.type==="num"){
        tk.next();
        return t.t;
    }else if(t.t==="{"){
        var res = {};
        each(parseLst('{','}',',',parsePaire,tk),function(e){
            res[e.key] = e.val;
        });
        return res;
    }else if(t.t==="["){
        return parseLst('[',']',",",parseObject,tk);
    }
}

//parse the notation int controller
function parseNotation(code){
    var tk = parser.parse(code),
        n=null,
        curParentPath='',
        pre = null,
        res = [],
        curNotation = null;
    while(!tk.eof()){
        n = tk.next();
        if(n.type==='notation'){
            if(n.t==='@RequestMapping'){
                var next = tk.peek();
                curNotation = {type:'mapping'};
                if(next.type==='punc'&&next.t==='('){
                    tk.next();
                    next = tk.peek();
                    if(next.type==='punc'&&next.t==='{'){
                        curNotation.cfg = parseObject(tk);
                    }else if(next.type==='string'){
                        curNotation.cfg = {path:next.t};
                    }
                }
            }else if(n.t==='@Service'){
                curNotation = {type:'serviceRef'};
                var next = tk.peek();
                if(next.type==='punc'&&next.t==='('){
                    tk.next();
                    next = tk.peek();
                    if(next.type==='string'){
                        curNotation.serviceName = next.t;
                        tk.next();
                    }
                    tk.next();
                }
                next = tk.peek();
                if(next.t==='class'){
                    curNotation = null;
                    tk.next();
                }
            }
        }else if(curNotation){
            //match the notaion's entity
            //if mapping
            if(curNotation.type==="mapping"&&n.type==='punc'&&(n.t==="{"||n.t==="(")&&pre.type==='id'){

                //class
                if(n.t==="{"){
                    curNotation.entityType = 'class';
                    curParentPath = curNotation.cfg.path||'';
                    curNotation.name = pre.t;

                 //action
                }else{
                    curNotation.cfg.path = curParentPath+curNotation.cfg.path;
                    curNotation.entityType = 'function';
                    curNotation.name = pre.t;
                }
                res.push(curNotation);
                curNotation = null;
                //if service
            }else if(curNotation.type==="serviceRef"&&n.type==='id'){
                if(!curNotation.serviceName){
                    curNotation.serviceName = n.t;
                }
                curNotation.propertyName = n.t;
                res.push(curNotation);
                curNotation = null;
            }
        }
        pre = n;
    }
    return res;
}

//convert the first character to lower
function lowerFirstChar(s){
    return s.charAt(0).toLowerCase()+s.substr(1);
}

//parse service notations
function parseServiceClsNotation(code){
    var tk = parser.parse(code),
        n=null,
        matchNotation = false,
        pre = null,
        preServiceName = '',
        res = [];
    while(!tk.eof()){
        n = tk.next();
        if(n.type==='notation'&&(n.t==='@Service')){
            var next = tk.peek();
            if(next.type==='punc'&&next.t==='('){
                tk.next();
                next = tk.peek();
                if(next.type==='string'){
                    preServiceName = next.t;
                }
            }
            matchNotation = true;
        }else if(matchNotation){
            if(n.type==='punc'&&n.t==="{"&&pre.type==='id'){
                res.push({type:'service',name:preServiceName||lowerFirstChar(pre.t),orgName:pre.t});
                matchNotation = false;
            }
        }
        pre = n;
    }
    return res;
}

//visit the specified dirs
function visitDir(ppath,pathMap,cb,after){
    if(pathMap[ppath]){
        return;
    }else{
        pathMap[ppath] = true;
    }
    if(!fs.existsSync(ppath)){
        throw Error('The dir :'+ppath+' don\'t exist');
    }
    fs.readdir(ppath,function(err,dirs){
        for(var i in dirs){
            if(dirs.hasOwnProperty(i)){
                let fileName = dirs[i],
                    curPath = ppath+ fileName;
                if(fs.statSync(curPath).isDirectory()){
                    visitDir(curPath+"/",pathMap,cb);
                }else{
                    cb(curPath);
                }
            }
        }
    });
    after&&after();
}


//load all the services
async function loadService(spath){
    return new Promise(r=>{
        if(!spath){
            r({});
            return;
        }
        var spaths = toArray(spath),
            totalCount = 0,
            readedCount=0,
            serviceMap = {},
            pathMap  ={};
        each(spaths,function(epath){
            visitDir(process.cwd()+epath,pathMap,function(curPath){
                totalCount ++;
                fs.readFile(curPath,'utf-8',function(err,code){
                    var res = parseServiceClsNotation(code);
                    each(res,function(e){
                        var p = require(path.relative(__dirname,curPath).replace(/\\/g,'/'))[e.orgName];
                        if(serviceMap[e.name]){
                            throw Error("存在重复的Service名称:"+e.name+"("+curPath+"),请设置别名！");
                        }else{
                            serviceMap[e.name] = {desc:e,newInstance:function(){return new p();}};
                        }
                    });
                    readedCount++;
                    if(totalCount===readedCount){
                        r(serviceMap);
                    }
                });
            });
        });

    });
}

//judge whether the url is collected or not
function hasCollected(url,method,map){
    var preUrl = url.replace(/\s/g,"");
    url = preUrl;
    if(/\{\w+:\w+\}/.test(url)){
        url = url.replace(/\{\w+:num\}/g,"{num:num}").replace(/\{\w+:string\}/g,"{string:string}");
    }
    var res = map[url]||false;
    if(!res){
        map[url] = {url:preUrl,method:method};
    }
    return (res&&res.method===method)?true:false;
}

//load the controllers
async function loadController(serviceMap,cpath){
    if(!cpath){
        throw Error("you must set the controller path!");
    }
    return new Promise((r1)=>{
        var cpaths = toArray(cpath),
            cTotalCount = 0,
            cReadedCount = 0,
            actionLst = [],
            urlMap = {},
            pathMap = {};
        each(cpaths,function(epath){
            visitDir(process.cwd()+epath,pathMap,function(curPath){
                cTotalCount++;
                fs.readFile(curPath,'utf-8',function(err,code){
                    var res = parseNotation(code),
                        classInstance = null,
                        clsCfg = null;
                    each(res,function(e){
                        if(e.type==="mapping"){
                            if(e.entityType==='class'){
                                clsCfg = e.cfg;
                                var c = require(path.relative(__dirname,curPath).replace(/\\/g,'/'))[e.name];
                                classInstance = new c();
                            }else if(e.entityType==='function'){
                                var cfg = e.cfg;
                                cfg.method = cfg.method||clsCfg.method;
                                if(!hasCollected(cfg.path,cfg.method,urlMap)){
                                    actionLst.push({
                                        path:cfg.path,
                                        method:cfg.method||clsCfg.method,
                                        middleware:cfg.middleware||clsCfg.middleware,
                                        action:classInstance[e.name],
                                        controller:classInstance,
                                        act:function(){
                                            classInstance[e.name].apply(classInstance,arguments);
                                        }
                                    });
                                }else{
                                    throw Error("the url: "+cfg.path+" , method: "+cfg.method+"  has been defined !");
                                }
                            }
                        }else if(e.type ==='serviceRef'){
                            var serviceCls = serviceMap[e.serviceName];
                            if(!serviceCls){
                                throw Error("can't find the service whose name is :"+e.serviceName);
                            }else{

                                classInstance[e.propertyName] = serviceCls.newInstance();
                            }

                        }
                    });
                    cReadedCount++;
                    if(cTotalCount === cReadedCount){
                        r1(actionLst);
                    }
                });
            });
        });

    });
}


//scan the services and controllers
async function scan(cfg){
    let sMap = await loadService(cfg.servicePath);
    return await loadController(sMap,cfg.controllerPath);
}
exports.scan = scan;
