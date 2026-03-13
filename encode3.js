function encode(text, key) {
    let str = unescape(encodeURIComponent(text));
    let hex = "";
    for(let i=0; i<str.length; i++) {
        let h = (str.charCodeAt(i) ^ key.charCodeAt(i % key.length)).toString(16);
        if(h.length === 1) h = "0" + h;
        hex += h;
    }
    return hex;
}

const msg = "I was wondering when you would reach this point.<br><br>Vale reached Node04 as well.<br><br>He stopped responding shortly after.<br><br>Be careful what you uncover.";
console.log(encode(msg, "NODE04"));
