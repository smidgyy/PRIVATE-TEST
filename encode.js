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
console.log(encode("So you solved Vale’s second lock.<br><br>Greed was only the beginning.<br><br>Greed leaves traces.<br><br>Vale tried to erase one of them.<br><br>Check the trash.", "GREED"));
console.log(encode("Correct.<br><br>Vale encrypted the next fragment.<br><br>Use the terminal.", "DEPTH"));
console.log(encode("No.<br><br>Money is only the mask.<br><br>Look deeper.", "MONEY"));
console.log(encode("Closer.<br><br>Vale didn’t follow wealth.<br><br>He followed power.<br><br>Listen.", "GOLD"));
console.log(encode("You are beginning to see the pattern.<br><br>Greed becomes wealth.<br><br>Wealth becomes power.<br><br>Vale reached this point.<br><br>But he went further.", "CROWN"));
