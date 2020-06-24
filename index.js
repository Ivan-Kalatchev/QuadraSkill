var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var _ = require('lodash');
const { Random } = require("random-js");
const random = new Random(); // uses the nativeMath engine

var lookingForGame = [];

var globalQuest = null;

var isInGame = false;

var currGame;

function containsObject(obj, list) {
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].id === obj.id) {
            return true;
        }
    }

    return false;
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log(`${socket.client.id} connected`);
    console.log(lookingForGame);
    socket.broadcast.emit('connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
        if (isInGame && lookingForGame.filter(user => user.id == socket.client.id)[0]) {
            io.emit("left", `${lookingForGame.filter(user => user.id == socket.client.id)[0].name}`);
            lookingForGame = lookingForGame.filter(user => user.id != socket.client.id);
            if (lookingForGame.length < 2) {
                io.emit('vam', "stop");
                isInGame = false;
                currGame = null;
                lookingForGame = [];
            }
        }

    });
    socket.on('vam', (ime) => {
        if (containsObject({ "id": socket.client.id, "name": ime }, lookingForGame)) {
            console.log(`vam already has ${ime} in mind`);
            console.log(lookingForGame)
        } else {
            lookingForGame.push({ "id": socket.client.id, "name": ime });
            console.log(lookingForGame)
        }
        if (lookingForGame.length > 1 && !isInGame) {
            var quest = null;
            while (!quest) {
                var a = random.integer(-10, 10);
                var b = random.integer(-10, 10);
                var c = random.integer(-10, 10);

                var x1 = (-1 * b + Math.sqrt(Math.pow(b, 2) - (4 * a * c))) / (2 * a);
                var x2 = (-1 * b - Math.sqrt(Math.pow(b, 2) - (4 * a * c))) / (2 * a);

                if (x1 == Math.floor(x1) && x2 == Math.floor(x2)) {
                    quest = {
                        "a": a,
                        "b": b,
                        "c": c,
                        "x1": x1,
                        "x2": x2,
                        "d": Math.sqrt(Math.pow(b, 2) - (4 * a * c))
                    }
                }
            }
            console.log(quest);
            globalQuest = quest;
            currGame = { "a": quest.a, "b": quest.b, "c": globalQuest.c };
            isInGame = true;
            io.emit('vam', {
                msg: "found",
                currGame,
                lookingForGame
            });
        } else if (isInGame) {
            io.emit("join", { "name": lookingForGame.filter(user => user.id == socket.client.id)[0].name, "id": lookingForGame.filter(user => user.id == socket.client.id)[0].id, "lookingForGame": lookingForGame });
            io.emit("vam", currGame);
        }
        //io.emit('chat message', msg);
    });
    socket.on('ans', (ans) => {
        //var discr = (b * b) - 4 * (a * c);
        //var sqrDiscr = Math.sqrt(discr);
        if (ans) {
            if (ans.d == globalQuest.d && ans.x1 == globalQuest.x1 && ans.x2 == globalQuest.x2 && lookingForGame.length > 1) {
                io.emit('ans', lookingForGame.filter(user => user.id == socket.client.id)[0].name);
                io.emit('vam', "stop");
                globalQuest = null;
                isInGame = false;
                lookingForGame = [];
            } else {
                io.to(socket.client.id).emit('error', "NO")
            }
        }

        //io.emit('chat message', msg);
    });
});

http.listen(process.env.PORT || 3000, () => {
    console.log('listening on *:3000 ');
});