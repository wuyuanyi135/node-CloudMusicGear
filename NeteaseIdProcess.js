const request = require('request');
const md5 = require('md5');
SongDetailHeader = { "cookie": "os=pc" };

function GetEncId( dfsId) {
    var magicBytes = new Buffer("3go8&$8*3*3h0k(2)2");
    var songId = new Buffer(dfsId);
    for (var i = 0; i < songId.Length; i++)
    {
        songId[i] = (byte)(songId[i] ^ magicBytes[i % magicBytes.length]);
    }
    var hash = md5(songId);
    return hash.toString('base64').replace('/', '_').replace('+', '-');
}
function GenerateUrl(dfsId) {
    return `http://m1.music.126.net/${GetEncId(dfsId)}/${dfsId}.mp3"`;
}
function GetDfsId(pageContent, nQuality) {

    var root = JSON.parse(pageContent);
        // Downgrade if we don't have higher quality...

    if (nQuality == "h" && !root["songs"][0]["h"])
    {
        nQuality = "m";
    }
    if (nQuality == "m" && !root["songs"][0]["m"])
    {
        nQuality = "l";
    }
    if (nQuality == "l" && !root["songs"][0]["l"])
    {
        nQuality = "b";
    }

    if (nQuality == "b" && !root["songs"][0]["b"])
    {
    }

    return root["songs"][0][nQuality]["fid"];
}
function GetUrl(songId, nQuality) {
    var data = `c=[{"id":"${songId}","v":0}]`;
    options = {
        method: 'post',
        body: data,
        url: "http://music.163.com/api/v2/song/detail",
        headers: SongDetailHeader
    };
    var page = request(options);
    var dfsId = GetDfsId(page, nQuality);
    return GenerateUrl(dfsId);
}
module.exports = {GetUrl};
