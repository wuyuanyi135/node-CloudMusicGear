var nip = require('./NeteaseIdProcess.js');
var request = require('request');
var url = require('url');
const serversList = require('./serversList');
const Config = {
    PlaybackQuality: "HQ / 320000",
    DownloadQuality: "HQ / 320000",
    ForceIp : 1,
    IpAddress: serversList.activeList[0],
    IpAddressList: serversList.activeList

}
function LogEntry(msg) {
    console.log(msg);
}


function ConvertQuality(quality, mode)
{
   var fullQuality;
   switch (quality)
   {
       case "HQ / 320000":
       case "MQ / 192000":
       case "LQ / 128000":
       case "BQ / 96000":
           fullQuality = quality;
           break;
       case "HQ":
       case "320000":
           fullQuality = "HQ / 320000";
           break;
       case "MQ":
       case "192000":
           fullQuality = "MQ / 192000";
           break;
       case "LQ":
       case "128000":
           fullQuality = "LQ / 128000";
           break;
       case "BQ":
       case "96000":
           fullQuality = "BQ / 96000";
           break;
       default:
           throw new Error(`Can not convert quality = ${quality}`);
   }

   switch (mode)
   {
       case "Quality":
           return fullQuality.substring(0, 2);

       case "Bitrate":
           return fullQuality.substring(5);

       case "nQuality":
           return fullQuality.substring(0, 1).toLowerCase()();

       case "Full":
           return fullQuality;

       default:
           throw new Error(`Mode = ${mode}`);
   }
}

function GetPlayResponseUrl(apiResult) {
    try {
        apiResult = JSON.parse(apiResult);
    } catch (err) {
        throw new Error ('apiResult is not a valid json string');
    }
    return apiResult["data"][0]["url"];
}

function GetDownloadResponseCode() {
    try {
        apiResult = JSON.parse(apiResult);
    } catch (err) {
        throw new Error ('apiResult is not a valid json string');
    }
    return apiResult["data"]["code"];
}

function GetPlaybackBitrateFromApi( apiResult) {
    try {
        apiResult = JSON.parse(apiResult);
    } catch (err) {
        throw new Error ('apiResult is not a valid json string');
    }
    return apiResult["data"][0]["br"];
}

function GetPlayResponseCode(apiResult) {
    try {
        apiResult = JSON.parse(apiResult);
    } catch (err) {
        throw new Error ('apiResult is not a valid json string');
    }
    return apiResult["data"][0]["code"];
}

function ModifyDownloadApi(originalContent) {
    LogEntry("Hack download API");
    var root;
    try {
        root = JSON.parse(originalContent);
    } catch (err) {
        throw new Error ('originalContent is not a valid json string');
    }
    var songId = root["data"]["id"];
    var newUrl = nip.GetUrl(songId, ConvertQuality(Config.DownloadQuality, "nQuality"));
    LogEntry(`New URL is ${newUrl}`);
    root["data"]["url"] = newUrl;
    root["data"]["br"] = ConvertQuality(Config.DownloadQuality, "Bitrate");
    root["data"]["code"] = "200";

    return JSON.stringify(root);
}

function ModifyDownloadLimitApi(originalContent) {
    LogEntry("Hack download API");
    var root;
    try {
        root = JSON.parse(originalContent);
    } catch (err) {
        throw new Error ('originalContent is not a valid json string');
    }
    var songId = root["data"]["id"];
    var newUrl = nip.GetUrl(songId, ConvertQuality(Config.DownloadQuality, "nQuality"));
    LogEntry(`"New URL is ${newUrl}"`);
    root["data"]["url"] = newUrl;
    root["data"]["br"] = ConvertQuality(Config.DownloadQuality, "Bitrate");
    root["data"]["code"] = "200";

    return JSON.stringify(root);
}

function ModifyPlayerApi( originalContent) {
    LogEntry("Player API Injected");
    var root;
    try {
        root = JSON.parse(originalContent);
    } catch (err) {
        throw new Error ('originalContent is not a valid json string');
    }
    var songId = originalContent["data"][0]["id"];
    var newUrl = nip.GetUrl(songId, ConvertQuality(Config.PlaybackQuality, "nQuality"));
    LogEntry(`"New URL is ${newUrl}"`);
    root["data"][0]["url"] = newUrl;
    root["data"][0]["br"] = ConvertQuality(Config.PlaybackQuality, "Bitrate");
    root["data"][0]["code"] = "200";

    return root.toString();
}

function ModifyDetailApi(originalContent) {
    LogEntry("Song Detail API Injected");
    var modified = originalContent;

    //fs.writeFile('./before.txt', modified);
    //Playback bitrate
    modified = modified.replace(/\"pl\":\d+/g, `\"pl\": ${ConvertQuality(Config.PlaybackQuality, "Bitrate")}`);

    // //Download bitrate
    modified = modified.replace(/\"dl\":\d+/g, `\"dl\": ${ConvertQuality(Config.DownloadQuality, "Bitrate")}`);

    // //Disabled
    modified = modified.replace(/\"st\":-?\d+/g, `\"st\":0`);

    // //Can favorite
    modified = modified.replace(/\"subp\":\d+/g, `\"subp\":1`);
    //fs.writeFile('./after.txt', modified);
    return modified;
}

function onResponse(res, body, client) {

    console.log(`${res.statusCode}\t${res.request.uri.path}`);
    var responseContentType = res.headers["content-type"];

    if (responseContentType) {
        responseContentType = responseContentType.trim().toLowerCase();
    } else {
        responseContentType = "";
    }

    var path = res.request.uri.path;

    if (res.statusCode == 200 && (responseContentType.indexOf("text/plain") !== -1 || responseContentType.indexOf("application/json") !== -1)) {
        LogEntry(`Accessing URL ${url.format(res.request.uri)}`);
        body = body.toString();
        if (
            path.startsWith("/eapi/v3/song/detail/") || path.startsWith("/eapi/v1/album/") ||
            path.startsWith("/eapi/v3/playlist/detail") ||
            path.startsWith("/eapi/batch") || path.startsWith("/eapi/cloudsearch/pc") ||
            path.startsWith("/eapi/v1/artist") ||
            path.startsWith("/eapi/v1/search/get") || path.startsWith("/eapi/song/enhance/privilege") ||
            path.startsWith("/eapi/v1/discovery/new/songs") || path.startsWith("/eapi/v1/play/record")
        ) {
            var modified = ModifyDetailApi(body);
            body=modified; // timing?? will change??

        } else if (path.startsWith("/eapi/song/enhance/player/url")) {

            // If the song URL is returned properly, or the returned quality is higher than the forced quality, we do not override the song URL.
            // This is designed as premium users may require lossless audio file.
            if  (GetPlayResponseCode(body) != "200" ||
                (
                    Config.ForcePlaybackQuality && parseInt(GetPlaybackBitrateFromApi(body)) <
                    parseInt(ConvertQuality(Config.PlaybackQuality, "Bitrate"))
                )
            ) {
                var bitrate = GetPlaybackBitrateFromApi(body);
                if (Config.ForcePlaybackQuality) {
                    bitrate = ConvertQuality(Config.PlaybackQuality, "Bitrate");
                    LogEntry(`Playback bitrate is forced set to ${bitrate}`);
                }
                // We receive a wrong bitrate...
                else if (bitrate == "0") {
                    bitrate = Config.ForcePlaybackQuality
                        ? ConvertQuality(Config.PlaybackQuality, "Bitrate")
                        : "320000";
                    LogEntry(`Playback bitrate is restored to ${bitrate} as the given bitrate is not valid.`);
                }
                // If we received an unexpected bitrate...
                else if (bitrate != ConvertQuality(Config.PlaybackQuality, "Bitrate"))
                {
                    LogEntry(`Playback bitrate is switched to ${bitrate} from ${ConvertQuality(Config.PlaybackQuality, "Bitrate")}`);
                }

                Config.PlaybackQuality = ConvertQuality(bitrate, "Full");
                var modified = ModifyPlayerApi(body);
                body = modified;
            } else {
                LogEntry(`Playback bitrate is not changed. The song URL is ${GetPlayResponseUrl(body)}`);
            }
        }

        // When we try to download a song, the API tells whether it exceeds the limit. Of course no!
        else if (path.startsWith("/eapi/song/download/limit"))
        {
            var modified = ModifyDownloadLimitApi();
            body = modified;
        }

        else if (path.startsWith("/eapi/song/enhance/download/url"))
        {
            // If the song URL is returned properly, or the returned quality is higher than the forced quality, we do not override the song URL.
            // This is designed as premium users may require lossless audio file.
            if (
                GetDownloadResponseCode(body) != "200" ||
                (Config.ForceDownloadQuality &&
                 parseInt(GetDownloadBitrate(body)) <
                 parseInt(ConvertQuality(Config.DownloadQuality, "Bitrate")))
             ) {
                var bitrate = GetDownloadBitrate(body);

                // Whatever current download bitrate is, it's overriden.
                if (Config.ForceDownloadQuality)
                {
                    bitrate = ConvertQuality(Config.DownloadQuality, "Bitrate");
                    LogEntry(`Download bitrate is forced set to ${bitrate}`);
                }
                // We receive a wrong bitrate...
                else if (bitrate == "0")
                {
                    bitrate = Config.ForceDownloadQuality
                        ? ConvertQuality(Config.DownloadQuality, "Bitrate")
                        : "320000";
                    LogEntry(`"Download bitrate is forced set to ${bitrate} as the given bitrate is not valid.`);
                }
                else if (bitrate != ConvertQuality(Config.DownloadQuality, "Bitrate"))
                {
                    LogEntry(`"Download bitrate is switched to ${bitrate} from ${ConvertQuality(Config.DownloadQuality, "Bitrate")}`);
                }
                Config.DownloadQuality = ConvertQuality(bitrate, "Full");

                var modified = ModifyDownloadApi(body);
                body = modified;
            }
            else
            {
                LogEntry(`Download bitrate is not changed. The song URL is ${GetDownloadResponseUrl(body)}`);
            }
        }
    } else {
        if (res.statusCode >= 400 && path.indexOf(".mp3") !== -1) {
            LogEntry(`Song load failed from ${Config.IpAddress}`);
            if (Config.ForceIp)
            {
                var ipIndex = null;
                try
                {
                    ipIndex = Config.IpAddressList.indexOf(Config.IpAddress) + 1;
                    if (ipIndex == Config.IpAddressList.length)
                    {
                        ipIndex = 0;
                    }
                }
                catch (e)
                {
                    if (Config.IpAddressList.Count > 0) ipIndex = 0;
                }

                if (ipIndex != null)
                {
                    Config.IpAddress = Config.IpAddressList[ipIndex];
                }

                LogEntry(`Cannot load song, try next IP: ${Config.IpAddress}`);
            }
            else
            {
                LogEntry(`This song ${path} is not available on the server.`);
            }
        }
    }

    client.status(res.statusCode);
    //client.set(res.headers);
    client.send(body);
    body = null;
}

module.exports = {
    'onResponse': onResponse,
    'Config': Config
}
