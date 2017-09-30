//let teamScores = null;
let request = prompt("Enter server address:port", "ws://127.0.0.1:443");
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let leaderboard = [];
let ws = null;
let nodeX = 0;
let nodeY = 0;
let nodesOnScreen = [];
let playerCells = [];
let nodes = {};
let nodelist = [];
let Cells = [];
let rawMouseX = 0;
let rawMouseY = 0;
let X = -1;
let Y = -1;
let timestamp = 0;
let userNickName = null;
let leftPos = 0;
let topPos = 0;
let rightPos = 1E4;
let bottomPos = 1E4;
let viewZoom = 1;
let showName = true;
let userScore = 0;
let posX = nodeX = ~~((leftPos + rightPos) / 2);
let posY = nodeY = ~~((topPos + bottomPos) / 2);
let posSize = 1;
let zoom = 1;
let minX = 0;
let minY = 0;
let maxX = 0;
let maxY = 0;
let noRanking = false;
let options = {
    delay: 120,
    sectors: false,
    borders: false,
    bgColour: "222222",
    borderColour: "FFA500",
    sectorColour: "1A1A1A"
};

let fps = {
    startTime: 0,
    frameNumber: 0,
    getFPS: function () {
        this.frameNumber++;
        var d = new Date().getTime(),
            currentTime = (d - this.startTime) / 1000,
            result = Math.floor((this.frameNumber / currentTime));
        if (currentTime > 1) {
            this.startTime = new Date().getTime();
            this.frameNumber = 0;
        }
        return result;
    }
};

$(document).ready(function () {
    connect(request, true);
});

function Main() {
    document.getElementById("canvas").focus();
    canvas = document.getElementById("canvas");
    canvas.onmousemove = function (event) {
        rawMouseX = event.clientX;
        rawMouseY = event.clientY;
        updateMouse()
    };
    document.body.onmousewheel = handleWheel;
    window.onresize = canvasResize;
    if (window.requestAnimationFrame) {
        reDraw();
    }
    setInterval(sendMouseMove, 1);
    canvasResize();
    showOverlays(true)
}

function updateMouse() {
    X = (rawMouseX - ctx.canvas.width / 2) / viewZoom + nodeX;
    Y = (rawMouseY - ctx.canvas.height / 2) / viewZoom + nodeY
}

function hideOverlays() {
    $("#overlays").hide();
}

function updateWindowFunctions() {

    // Window functions

    window.onkeydown = function (event) {
        switch (event.keyCode) {
            case 32:
                // Space (Split)
                sendUint8(17);
                break;
            case 81:
                // Q
                sendUint8(18);
                break;
            case 87:
                // W
                sendUint8(21);
                break;
            case 27:
                // ESC (Menu)
                showOverlays(true);
                break;
            case 80:
                // P (Collect pellets)
                sendUint8(25);
                break;
        };

    };

    window.setNick = function (arg) {
        hideOverlays();
        userNickName = arg;
        sendNickName();
        userScore = 0
    };

    window.watch = function () {
        userNickName = null;
        sendUint8(1);
        hideOverlays()
    };

    // Handle options

    $("#delay").on("input", function () {
        $("#animationTxt").text("Animation delay " + $("#delay").val());
        options.delay = Number($("#delay").val());
    });

    $("#sectors").change(function () {
        options.sectors = $(this).is(':checked');
    });

    $("#borders").change(function () {
        options.borders = $(this).is(':checked');
    });

    $("#bgColour").change(function () {
        options.bgColour = $("#bgColour").val();
    });

    $("#borderColour").change(function () {
        options.borderColour = $("#borderColour").val();
    });

    $("#sectorColour").change(function () {
        options.sectorColour = $("#sectorColour").val();
    });

    if (playerCells.length === 0) {
        showOverlays(true)
    }
}

function showOverlays(arg) {
    userNickName = null;
    $("#overlays").fadeIn(600);
}

function resetVars() {
    nodesOnScreen = [];
    playerCells = [];
    nodes = {};
    nodelist = [];
    Cells = [];
    leaderboard = [];
    canvas = /*teamScores =*/ null;
    userScore = 0;
}

function connect(url) {
    console.log("Connecting to " + url);
    ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    ws.onmessage = onWsMessage;
    ws.onerror = function (e) {
        console.log("Error " + e);
    }
    ws.onopen = function () {
        resetVars();
        var msg = prepareData(5);
        msg.setUint8(0, 254);
        msg.setUint32(1, 4, true);
        send(msg);
        var msg = prepareData(5);
        msg.setUint8(0, 255);
        msg.setUint32(1, 1332175218, true);
        send(msg);
        setTimeout(function () {
            console.log('Connected to server!');
        }, 1000);
    }
    ws.onclose = function (e) {
        connect(request);
        console.log("Disconnected from server!");
    }
}

function handleWheel(event) {
    zoom *= Math.pow(.9, event.wheelDelta / -120 || event.detail || 0); - 1 > zoom && (zoom = -1);
    zoom > 4 / viewZoom && (zoom = 4 / viewZoom)
}

function onWsMessage(msg) {
    handleMessage(new DataView(msg.data));
}

function prepareData(data) {
    return new DataView(new ArrayBuffer(data))
}

function send(data) {
    ws.send(data.buffer)
}

function handleMessage(msg) {
    function getString() {
        var text = '',
            char;
        while ((char = msg.getUint16(offset, true)) != 0) {
            offset += 2;
            text += String.fromCharCode(char);
        }
        offset += 2;
        return text;
    }

    var offset = 0,
        setCustomLB = false;

    /** Pakcet ID's
     * 16: Tick (Update Nodes).
     * 17: Position update 
     * 20: Clear Nodes (Clears nodes that are currently on screen).
     * 32: Add Nodes.
     * 48: Custom leader board. (Notifies the client).
     * 49: Update Leaderboard for Free For All and related gamemodes.
     * 50: Update Loaderboard for the Teams gamemode.
     * 64: Border (Left, Right, Top and Bottom).
     * 99: Add chat message.
     */

    switch (msg.getUint8(offset++)) {
        case 16:
            updateNodes(msg, offset);
            break;
        case 17:
            posX = msg.getFloat32(offset, true);
            offset += 4;
            posY = msg.getFloat32(offset, true);
            offset += 4;
            posSize = msg.getFloat32(offset, true);
            offset += 4;
            break;
        case 20:
            playerCells = [];
            nodesOnScreen = [];
            break;
        case 32:
            nodesOnScreen.push(msg.getUint32(offset, true));
            offset += 4;
            break;
        case 48:
            setCustomLB = true;
            noRanking = true;
            break;
        case 49:
            if (!setCustomLB) {
                noRanking = false;
            }
            //teamScores = null;
            var LBplayerNum = msg.getUint32(offset, true);
            offset += 4;
            leaderboard = [];
            for (i = 0; i < LBplayerNum; ++i) {
                var nodeId = msg.getUint32(offset, true);
                offset += 4;
                leaderboard.push({
                    id: nodeId,
                    name: getString()
                });
            }
            break;
        /*case 50:
            teamScores = [];
            var LBteamNum = msg.getUint32(offset, true);
            offset += 4;
            for (var i = 0; i < LBteamNum; ++i) {
                teamScores.push(msg.getFloat32(offset, true));
                offset += 4;
            }
            break;*/
        case 64:
            leftPos = msg.getFloat64(offset, true);
            offset += 8;
            topPos = msg.getFloat64(offset, true);
            offset += 8;
            rightPos = msg.getFloat64(offset, true);
            offset += 8;
            bottomPos = msg.getFloat64(offset, true);
            offset += 8;
            posX = (rightPos + leftPos) / 2;
            posY = (bottomPos + topPos) / 2;
            posSize = 1;
            if (0 == playerCells.length) {
                nodeX = posX;
                nodeY = posY;
                viewZoom = posSize;
            }
            minX = leftPos;
            minY = topPos;
            maxX = rightPos;
            maxY = bottomPos;
            break;
        case 99:
            // Reserve for a chat function
            break;

    }
}

function updateNodes(view, offset) {
    timestamp = +new Date;
    var code = Math.random();
    var queueLength = view.getUint16(offset, true);
    offset += 2;
    for (i = 0; i < queueLength; ++i) {
        var killer = nodes[view.getUint32(offset, true)],
            killedNode = nodes[view.getUint32(offset + 4, true)];
        offset += 8;
        if (killer && killedNode) {
            killedNode.destroy();
            killedNode.ox = killedNode.x;
            killedNode.oy = killedNode.y;
            killedNode.oSize = killedNode.size;
            killedNode.nx = killer.x;
            killedNode.ny = killer.y;
            killedNode.nSize = killedNode.size;
            killedNode.updateTime = timestamp;
        }
    }
    for (var i = 0;;) {
        var nodeid = view.getUint32(offset, true);
        offset += 4;
        if (0 == nodeid) break;
        ++i;
        var size, posY, posX = view.getInt16(offset, true);
        offset += 2;
        posY = view.getInt16(offset, true);
        offset += 2;
        size = view.getInt16(offset, true);
        offset += 2;
        for (var r = view.getUint8(offset++), g = view.getUint8(offset++), b = view.getUint8(offset++), color = (r << 16 | g << 8 | b).toString(16); 6 > color.length;) color = "0" + color;
        var colorstr = "#" + color,
            flags = view.getUint8(offset++),
            flagVirus = !!(flags & 1),
            flagPlayer = !!(flags & 16);
        flags & 2 && (offset += 4);
        flags & 4 && (offset += 8);
        flags & 8 && (offset += 16);
        for (var char, name = "";;) {
            char = view.getUint16(offset, true);
            offset += 2;
            if (0 == char) break;
            name += String.fromCharCode(char)
        }
        var node = null;
        if (nodes.hasOwnProperty(nodeid)) {
            node = nodes[nodeid];
            node.updatePos();
            node.ox = node.x;
            node.oy = node.y;
            node.oSize = node.size;
            node.color = colorstr;
        } else {
            node = new Cell(nodeid, posX, posY, size, colorstr, name);
            nodelist.push(node);
            nodes[nodeid] = node;
            node.ka = posX;
            node.la = posY;
        }
        node.isVirus = flagVirus;
        node.isPlayer = flagPlayer;
        node.nx = posX;
        node.ny = posY;
        node.nSize = size;
        node.updateCode = code;
        node.updateTime = timestamp;
        node.flag = flags;
        if (-1 != nodesOnScreen.indexOf(nodeid) && -1 == playerCells.indexOf(node)) {
            document.getElementById("overlays").style.display = "none";
            playerCells.push(node);
            if (1 == playerCells.length) {
                nodeX = node.x;
                nodeY = node.y;
            }
        }
    }
    queueLength = view.getUint32(offset, true);
    offset += 4;
    for (i = 0; i < queueLength; i++) {
        var nodeId = view.getUint32(offset, true);
        offset += 4;
        node = nodes[nodeId];
        null != node && node.destroy();
    }
}

function Sectors() {
    // Taken from AgarPlus

    if (options.sectors === true) {
        ctx.strokeRect(minX, maxY, 500, 500);
        var x = Math.round(minX) + 40;
        var y = Math.round(minY) + 40;
        var second = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        var barWidth = (Math.round(maxX) - 90 - x) / 5;
        var h = (Math.round(maxY) - 40 - y) / 5;
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 0.05;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = barWidth * 0.6 + "px Russo One";
        ctx.fillStyle = "#" + options.sectorColour;
        var j = 0;
        for (; 5 > j; j++) {
            var i = 0;
            for (; 5 > i; i++) {
                ctx.fillText(second[j] + (i + 1), x + barWidth * i + barWidth / 2, y + h * j + h / 2);
            }
        }
        ctx.lineWidth = 100;
        ctx.strokeStyle = "#1A1A1A";
        j = 0;
        for (; 5 > j; j++) {
            i = 0;
            for (; 5 > i; i++) {
                ctx.strokeRect(x + barWidth * i, y + h * j, barWidth, h);
            }
        }
        ctx.stroke();
        ctx.restore();
    };
}

function sendMouseMove() {
    var msg;
    if (wsIsOpen()) {
        msg = rawMouseX - ctx.canvas.width / 2;
        var b = rawMouseY - ctx.canvas.height / 2;
        msg = prepareData(21);
        msg.setUint8(0, 16);
        msg.setFloat64(1, X, true);
        msg.setFloat64(9, Y, true);
        msg.setUint32(17, 0, true);
        send(msg);
    }
}

function sendNickName() {
    if (wsIsOpen() && null != userNickName) {
        var msg = prepareData(1 + 2 * userNickName.length);
        msg.setUint8(0, 0);
        for (var i = 0; i < userNickName.length; ++i) msg.setUint16(1 + 2 * i, userNickName.charCodeAt(i), true);
        send(msg)
    }
}

function wsIsOpen() {
    return null != ws && ws.readyState == ws.OPEN
}

function sendUint8(data) {
    if (wsIsOpen()) {
        var msg = prepareData(1);
        msg.setUint8(0, data);
        send(msg)
    }
}

function reDraw() {
    Draw();
    window.requestAnimationFrame(reDraw)
}

function canvasResize() {
    window.scrollTo(0, 0);
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
    ctx.canvas.width = ctx.canvas.width;
    ctx.canvas.height = ctx.canvas.height;
}

function viewRange() {
    var ratio;
    ratio = Math.max(ctx.canvas.height / 1080, ctx.canvas.width / 1920);
    return ratio * zoom;
}

function calcViewZoom() {
    if (0 != playerCells.length) {
        for (var newViewZoom = 0, i = 0; i < playerCells.length; i++) newViewZoom += playerCells[i].size;
        newViewZoom = Math.pow(Math.min(64 / newViewZoom, 1), .4) * viewRange();
        viewZoom = (9 * viewZoom + newViewZoom) / 10
    }
}

function Draw() {

    var a, oldtime = Date.now();
    timestamp = oldtime;

    if (0 < playerCells.length) {
        calcViewZoom();
        var c = a = 0;
        for (var d = 0; d < playerCells.length; d++) {
            playerCells[d].updatePos();
            a += playerCells[d].x / playerCells.length;
            c += playerCells[d].y / playerCells.length;
        }
        posX = a;
        posY = c;
        posSize = viewZoom;
        nodeX = (nodeX + a) / 2;
        nodeY = (nodeY + c) / 2
    } else {
        nodeX = (29 * nodeX + posX) / 30;
        nodeY = (29 * nodeY + posY) / 30;
        viewZoom = (9 * viewZoom + posSize * viewRange()) / 10;
    }

    updateMouse();
    drawBackground();

    nodelist.sort(function (a, b) {
        return a.size == b.size ? a.id - b.id : a.size - b.size
    });

    ctx.save();
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.scale(viewZoom, viewZoom);
    ctx.translate(-nodeX, -nodeY);
    Sectors();
    Borders();
    for (d = 0; d < Cells.length; d++) Cells[d].drawOneCell(ctx);
    for (d = 0; d < nodelist.length; d++) nodelist[d].drawOneCell(ctx);
    ctx.restore();
    userScore = Math.max(userScore, calcUserScore());

    //Score
    let scoreText = "Score " + ~~(userScore / 100);
    ctx.globalAlpha = 1;
    ctx.font = '20px Tahoma';
    ctx.fillStyle = '#FFF';
    ctx.fillText(scoreText, 10, 25);

    // FPS
    let frames = fps.getFPS();
    let fpsText = "FPS " + frames;

    if (frames >= 40) {
        ctx.fillStyle = "#00FF00";
    } else if (frames >= 30) {
        ctx.fillStyle = "#FFFF33";
    } else {
        ctx.fillStyle = "#FF0000";
    };

    ctx.globalAlpha = 1;
    ctx.font = '20px Tahoma';
    ctx.fillText(fpsText, 10, 50);

    if (leaderboard.length === 0) {
        return;
    };

    // Very simple leaderboard
    for (var i = 0; i < leaderboard.length; i++) {
        const section = leaderboard[i];
        const name = (i + 1) + ". " + section.name;
        const y = 25;
        ctx.globalAlpha = .8;
        ctx.strokeStyle = "#000"
        ctx.font = '15px Tahoma';
        ctx.fillStyle = "#FFF";
        ctx.fillText(name, (ctx.canvas.width - 200), 40 + 24 * i);
    };

    ctx.restore();

}

function Borders() {
    if (options.borders === true) {
        ctx.save();
        ctx.strokeStyle = "#" + options.borderColour;
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(minX, minY);
        ctx.lineTo(maxX, minY);
        ctx.lineTo(maxX, maxY);
        ctx.lineTo(minX, maxY);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}

function drawBackground() {
    ctx.fillStyle = "#" + options.bgColour;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
}

function calcUserScore() {
    for (var score = 0, i = 0; i < playerCells.length; i++) score += playerCells[i].nSize * playerCells[i].nSize;
    return score
}

function Cell(id, x, y, size, color, name) {
    this.id = id;
    this.ox = this.x = x;
    this.oy = this.y = y;
    this.oSize = this.size = size;
    this.color = color;
    this.points = [];
    this.pointsAcc = [];
    this.createPoints();
    this.name = name;
}

Cell.prototype = {
    id: 0,
    points: null,
    pointsAcc: null,
    name: null,
    x: 0,
    y: 0,
    size: 0,
    ox: 0,
    oy: 0,
    oSize: 0,
    nx: 0,
    ny: 0,
    nSize: 0,
    flag: 0,
    updateTime: 0,
    updateCode: 0,
    delay: 0,
    destroyed: false,
    isVirus: false,
    destroy: function () {
        var tmp;
        for (tmp = 0; tmp < nodelist.length; tmp++)
            if (nodelist[tmp] == this) {
                nodelist.splice(tmp, 1);
                break
            }
        delete nodes[this.id];
        tmp = playerCells.indexOf(this);
        if (-1 != tmp) {
            playerCells.splice(tmp, 1);
        }
        tmp = nodesOnScreen.indexOf(this.id);
        if (-1 != tmp) {
            nodesOnScreen.splice(tmp, 1);
        }
        this.destroyed = true;
        Cells.push(this)
    },
    getNameSize: function () {
        return Math.max(~~(.3 * this.size), 24)
    },
    createPoints: function () {
        for (var samplenum = this.getNumPoints(); this.points.length > samplenum;) {
            var rand = ~~(Math.random() * this.points.length);
            this.points.splice(rand, 1);
            this.pointsAcc.splice(rand, 1)
        }
        if (0 == this.points.length && 0 < samplenum) {
            this.points.push({
                ref: this,
                size: this.size,
                x: this.x,
                y: this.y
            });
            this.pointsAcc.push(Math.random() - .5);
        }
        while (this.points.length < samplenum) {
            var rand2 = ~~(Math.random() * this.points.length),
                point = this.points[rand2];
            this.points.splice(rand2, 0, {
                ref: this,
                size: point.size,
                x: point.x,
                y: point.y
            });
            this.pointsAcc.splice(rand2, 0, this.pointsAcc[rand2])
        }
    },
    getNumPoints: function () {
        if (0 == this.id) return 16;
        var a = 10;
        if (20 > this.size) a = 0;
        if (this.isVirus) a = 40;
        var b = this.size;
        if (!this.isVirus)(b *= viewZoom);
        if (this.flag & 32)(b *= .5);
        return ~~Math.max(b, a);
    },
    updatePos: function () {
        if (0 == this.id) return 1;
        var a;
        a = (timestamp - this.updateTime) / options.delay;
        a = 0 > a ? 0 : 1 < a ? 1 : a;
        var b = 0 > a ? 0 : 1 < a ? 1 : a;
        this.getNameSize();
        if (this.destroyed && 1 <= b) {
            var c = Cells.indexOf(this); - 1 != c && Cells.splice(c, 1)
        }
        this.x = a * (this.nx - this.ox) + this.ox;
        this.y = a * (this.ny - this.oy) + this.oy;
        this.size = b * (this.nSize - this.oSize) + this.oSize;
        return b;
    },
    shouldRender: function () {
        if (0 == this.id) {
            return true
        } else {
            return !(this.x + this.size + 40 < nodeX - ctx.canvas.width / 2 / viewZoom || this.y + this.size + 40 < nodeY - ctx.canvas.height / 2 / viewZoom || this.x - this.size - 40 > nodeX + ctx.canvas.width / 2 / viewZoom || this.y - this.size - 40 > nodeY + ctx.canvas.height / 2 / viewZoom);
        }
    },
    drawOneCell: function (ctx) {
        if (this.shouldRender()) {

            ctx.save();
            c = this.updatePos();
            this.destroyed && (ctx.globalAlpha *= 1 - c);
            ctx.lineWidth = 10;
            ctx.fillStyle = this.color;

            // Draw nodes
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, .1, 2 * Math.PI, false);
            ctx.closePath();
            ctx.fill();

            // Draw skins
            if (-1 != playerCells.indexOf(this)) {
                const skin = new Image;
                const skinUrl = String($("#skinUrl").val());

                if (skinUrl.substr(0, 20) === "https://i.imgur.com/") {
                    skin.src = skinUrl;
                };

                ctx.save();
                ctx.clip();
                ctx.drawImage(skin, this.x - this.size, this.y - this.size, 2 * this.size, 2 * this.size);
                ctx.restore();

            }

            if (0 != this.id) {

                // Cell stroke
                ctx.strokeStyle = this.color;
                ctx.globalAlpha = .7;
                ctx.stroke();

                // Draw name
                if (this.name && ~~(this.size * this.size / 100) >= 200) {
                    ctx.globalAlpha = 1;
                    ctx.font = Math.max(~~(.3 * this.size), 24) + 'px Tahoma';
                    ctx.fillStyle = '#FFF';
                    ctx.textAlign = "center";
                    ctx.fillText(this.name, this.x, this.y);
                };

                // Draw size
                if (~~(this.size * this.size / 100) >= 20) {
                    ctx.globalAlpha = 1;
                    ctx.font = Math.max(~~(.3 * this.size), 24) + 'px Tahoma';
                    ctx.fillStyle = '#FFF';
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(~~(this.size * this.size / 100), this.x, this.y + 60);
                };
            }
            ctx.restore()
        }
    }
};

Main();

setInterval(updateWindowFunctions, 100);