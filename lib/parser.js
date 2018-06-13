/**
 * controller和service配置的解析模块，解析配置，配置是组装的依据
 * author: lantao.wang
 */

function inputStream(pstr){
    var str = pstr,curIndex = 0,row=1,l = pstr.length||0;
    function peek(){
        return str.charAt(curIndex);
    }

    function next(){
        var c = str.charAt(curIndex++);
        if(/\r/.test(c)){
            row++;
            if(/\n/.test(str.charAt(curIndex+1))){
                curIndex++;
            }
        }
        return c;
    }

    function eof(){
        return curIndex+1>l;
    }

    function jumpPeek(off){
        var i = curIndex+off;
        i = i>=0?(i<=l?i:l):0;
        return str.charAt(i);
    }

    function jump(off){
        var i = curIndex+off;
        curIndex = i>=0?(i<=l?i:l):0;
        return str.charAt(curIndex);
    }

    function getCurIndex(){
        return curIndex;
    }

    function setCurIndex(i){
        curIndex = i;
    }
    return {
        peek:peek,
        next:next,
        jumpPeek:jumpPeek,
        jump:jump,
        eof:eof,
        getCurIndex:getCurIndex,
        setCurIndex:setCurIndex,
        row:function(){
            return row;
        }
    };
}



//tokenizer
function Tokenizer(code){
    var input = new inputStream(code),
        curTokenStr = '',
        curIndex = 0,
        cache = {},
        cur = null,
        pre=null;


    function isIdStart(c){
        return /\_|\$|[a-zA-Z]/.test(c);
    }

    function isIdPart(c){
        return /\_|\$|[a-zA-Z]|\d/.test(c);
    }
    var keys = ' package public private class async await import return if else while for break continue true false case switch try catch Array String Date in new with';

    function isKeyword(t){
        return keys.indexOf(' '+t+' ')>-1;
    }

    function isPunc(c){
        return ',[]{}();.:\\=\'\"+-*/%!&|<>?@'.indexOf(c)>-1;
    }

    function isStringMark(mark){
        var cur = input.peek(),
            pre1 = input.jumpPeek(-1),
            pre2 = input.jumpPeek(-2);
        if(mark){
            return (mark===cur)&&((pre1!=='\\')||(pre1==='\\'&&pre2==='\\'));
        }else{
            return (/\'|\"/.test(cur))&&((pre1!=='\\')||(pre1==='\\'&&pre2==='\\'));
        }

    }

    function readString(){
        if(isStringMark()){
            var mark = input.next();
            curTokenStr = '';
            while(!isStringMark(mark)&&!input.eof()){
                curTokenStr += input.next();
            }
            input.next();
        }
        return curTokenStr;
    }

    function readNotation(){
        if(input.peek()==='@'){
            input.next();
            return '@'+readId();
        }
        return '@';
    }
    function isNum(){
        return /\d/.test(input.peek());
    }

    function isRegMark(){
        return input.peek()==="/"&&(input.jumpPeek(-1)!=='\\');
    }

    function readReg(){
        var scope = [];
        if(isRegMark()){
            input.next();
            curTokenStr = '';
            while(!isRegMark()&&!input.eof()){
                curTokenStr += input.next();
            }
            input.next();
            while(input.peek()==='g'||input.peek()==='i'){
                scope.push(input.next());
            }
        }
        return {t:curTokenStr,type:'reg',r:input.row(),scope:scope};
    }

    function readNum(){
        if(isNum()){
            curTokenStr = input.next();
            var hasDot = false;
            while(isNum()||(input.peek()==='.'&&!hasDot)){
                if(input.peek()==='.'){
                    hasDot = true;
                }
                curTokenStr +=input.next();
            }
            return curTokenStr;
        }
    }

    function readId(){
        if(isIdStart(input.peek())){
            curTokenStr = input.next();
            while(isIdPart(input.peek())){
                curTokenStr += input.next();
            }
        }
        return curTokenStr;
    }
    function isBlank(){
        return /\s/.test(input.peek());
    }

    // skip blank
    function skipBlank(){
        while(isBlank()){
            input.next();
        }
    }

    //skip single
    function skipSingleComment(){
        while(!/\r|\n|\r\n/.test(input.peek())&&!input.eof()){
            input.next();
        }
        input.next();
    }

    //skip multiline notions
    function skipMultiComment(){
        input.next();
        while(!(input.peek()==='/'&&input.jumpPeek(-1)==='*')){
            input.next();
        }
        input.next();
    }

    //is operator start
    function isOpStart(c){
        return /&|\||\!|\?|\+|\-|\*|\/|%|<|>|\=/.test(c);
    }

    //next token
    function read(clear,pIndex){
        if(cache[pIndex]){
            pre = cur;
            cur = cache[pIndex];
        }else{
            skipBlank();
            pre = cur;
            if(isIdStart(input.peek())){
                curTokenStr = readId();
                cur = {t:curTokenStr,type:isKeyword(curTokenStr)?'keyword':'id',r:input.row()};
            }else if(isPunc(input.peek())){
                if(isStringMark()){
                    curTokenStr = readString();
                    cur = {t:curTokenStr,type:'string',r:input.row()};
                }else if(isRegMark()){
                    var next = input.jumpPeek(1);
                    if(next==='='){
                        input.next();
                        input.next();
                        cur = {t:'/=',type:'op-math_set',r:input.row()};
                    }else if(next==='/'){
                        skipSingleComment();
                        cur = {t:'',type:'comment-s',r:input.row()};
                    }else if(next==='*'){
                        skipMultiComment();
                        cur = {t:'',type:'comment-m',r:input.row()};
                    }else if(pre&&(pre.t===')'||pre.t===']'||pre.type==='id'||pre.type==='num')){
                        curTokenStr = input.next();
                        cur = {t:curTokenStr,type:'op-math',r:input.row()};
                    }else{
                        cur = readReg();
                    }

                }else if(isOpStart(input.peek())){

                    if(/&|\|/.test(input.peek())){
                        var punc1 = input.peek(),
                            nextChar = input.jumpPeek(1);
                        if(nextChar===punc1){
                            cur = {t:punc1+punc1,type:'op-bool',r:input.row()};
                            input.jump(2);
                        }else{
                            cur = {t:punc1,type:'op-bit',r:input.row()};
                            input.next();
                        }

                    }else if('!'===input.peek()){
                        var nextChar1 = input.jumpPeek(1),nextChar2 = input.jumpPeek(2);
                        if(nextChar1 === '=' && nextChar2 === '='){
                            cur = {t:'!==',type:'op-bool',r:input.row()};
                            input.jump(3);
                        }else if(nextChar1 === '='){
                            cur = {t:'!=',type:'op-bool',r:input.row()};
                            input.jump(2);
                        }else{
                            cur = {t:'!',type:'op-bool',r:input.row()};
                            input.next();
                        }
                    }else if(/\=/.test(input.peek())){
                        var nextChar1 = input.jumpPeek(1),
                            nextChar2 = input.jumpPeek(2);
                        if(nextChar1 === '=' && nextChar2 === '='){
                            cur = {t:'===',type:'op-bool',r:input.row()};
                            input.jump(3);
                        }else if(nextChar1 === '='){
                            cur = {t:'==',type:'op-bool',r:input.row()};
                            input.jump(2);
                        }else{
                            cur = {t:'=',type:'op-set',r:input.row()};
                            input.next();
                        }
                    }else if(/\<|\>/.test(input.peek())){

                        if(input.jumpPeek(1) === '='){
                            cur = {t:input.peek()+'=',type:'op-bool',r:input.row()};
                            input.jump(2);
                        }else{
                            cur = {t:input.peek(),type:'op-bool',r:input.row()};
                            input.next();
                        }

                    }else if(/\+|\-|\*|\/|%/.test(input.peek())){
                        var punc1 = input.peek(),
                            nextChar = input.jumpPeek(1);
                        if(nextChar==='='){
                            cur = {t:punc1+nextChar,type:'op-math_set',r:input.row()};
                            input.jump(2);
                        }else{
                            cur = {t:punc1,type:'op-math',r:input.row()};
                            input.next();
                        }

                    }else{
                        curTokenStr = input.next();
                        cur = {t:curTokenStr,type:'punc',r:input.row()};
                    }

                }else if(input.peek()==='@'){
                    curTokenStr = readNotation();
                    cur = {t:curTokenStr,type:'notation',r:input.row()};
                }else{
                    curTokenStr = input.next();
                    cur = {t:curTokenStr,type:'punc',r:input.row()};
                }
            }else if(isNum()){
                cur = {t:readNum(),type:'num',r:input.row()};
            }
        }

        cache[pIndex] = cur;
        clear&&(curIndex=pIndex+1);
        clear&&clearCache(pIndex);
        return cur;
    }

    function peek(){
        return jumpPeek(0);
    }

    function jumpPeek(off){
        var t  = {},oIndex = curIndex;
        for(var i = 0;i<=off;i++){
            t = read(false,oIndex+i);
        }
        return t;
    }

    function clearCache(d){
        for(var i in cache){
            if(d>(+i)){
                delete cache[i];
            }
        }
    }

    //返回当前值，游标移到下一个位置
    function next(){
        return jump(0);
    }

    function jump(off){
        var t  = {}, oIndex = curIndex;
        for(var i = 0;i<=off;i++){
            t = read(true,oIndex+i);
        }
        return t;
    }

    return {
        peek:peek,
        next:next,
        jump:jump,
        jumpPeek:jumpPeek,
        eof:function(){
            return input.eof();
        }
    };
}

exports.parse = Tokenizer;