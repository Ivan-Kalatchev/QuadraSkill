/*
  
MIT License

Copyright (c) 2020 Ivan-Kalatchev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

// Imports

var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
//var _ = require('lodash');
const path = require('path');
const db = require('./db/db');
let ejs = require('ejs');
const { Random } = require("random-js");
const random = new Random(); // uses the nativeMath engine

// init db
(async () => {
    await db.init();
})()

// Variables and essentials

var games = [];

// Methods

function questGen() {
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
                "d": Math.pow(b, 2) - (4 * a * c)
            }
        }
    }

    console.log(quest);
    return quest;
}

Object.defineProperty(Object.prototype, "ToUserReadable", {
    value: function ToUserReadable() {
        return { id: this.id, publicInfo: this.publicInfo, chats: this.chats, players: this.players, isPrivate: this.isPrivate };
    },
    writable: true,
    configurable: true
});

// Index

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('newIndex');
});

io.on('connection', async (socket) => {

    var top = await db.getTopThree();

    //Stat socket
    console.log(`${socket.client.id} connected`);

    io.to(socket.client.id).emit("id", socket.client.id)
    io.to(socket.client.id).emit("top", top)

    // Handle disconnect

    socket.on('disconnect', () => {
        var currGame = games.filter(game => game.players.filter(p => p.id == socket.client.id).length > 0)[0];
        if (currGame) {
            if (currGame.players.length == 1) {
                games = games.filter(x => x != currGame);
            } else {
                var index = games.indexOf(currGame);
                games[index].players = games[index].players.filter(x => x.id != socket.client.id);
                games[index].players.forEach(x => {
                    io.to(x.id).emit("left", socket.client.id);
                });
            }
        }
    });

    //Handle matchmaking
    socket.on('vamJoin', (username, gameId) => {
        var currGame = games.filter(game => game.id == gameId)[0];
        if (!currGame) {
            io.to(socket.client.id).emit("error", 1)
            return;
        }
        var index = games.indexOf(currGame);
        // Contact players
        games[index].players.forEach(player => {
            io.to(player.id).emit("join", { username: username, id: socket.client.id })
        });

        games[index].players.push({ username: username, id: socket.client.id })
        io.to(socket.client.id).emit("vam", games[index].ToUserReadable());
    });

    socket.on('vam', (playerUsername, playerIsNewGame, playerIsPrivate) => {

        var publicGames = games.filter(game => !game.isPrivate);

        // Check for a game that's running
        if (!playerIsNewGame && !playerIsPrivate && games.length != null && publicGames.length > 0) {

            var index = games.indexOf(publicGames[0]);
            // Contact players
            games[index].players.forEach(player => {
                io.to(player.id).emit("join", { username: playerUsername, id: socket.client.id })
            });

            games[index].players.push({ username: playerUsername, id: socket.client.id })
            io.to(socket.client.id).emit("vam", games[index].ToUserReadable());

        } else {

            // Create a new game
            var q = questGen();
            var newGame = {
                id: random.integer(1000, 9999).toString(),
                quest: q,
                start: new Date(),
                publicInfo: { a: q.a, b: q.b, c: q.c },
                isPrivate: playerIsPrivate,
                chats: [],
                players: [
                    {
                        id: socket.client.id,
                        username: playerUsername
                    }
                ]
            }

            // Put game
            games.push(newGame);

            // Contact player
            io.to(socket.client.id).emit("vam", newGame.ToUserReadable())

        }


    });

    // Handle answers

    socket.on('ans', async (d, x1, x2) => {
        var currGame = games.filter(game => game.players.filter(p => p.id == socket.client.id).length > 0)[0];
        if (currGame && ((x1 == currGame.quest.x1 && x2 == currGame.quest.x2) || (x2 == currGame.quest.x1 && x1 == currGame.quest.x2) ) && d == currGame.quest.d) {
            await db.registerRecord(currGame.players.filter(y => y.id == socket.client.id)[0].username, (currGame.start.getTime() - new Date().getTime()) / -1000)
            currGame.players.forEach(x => {
                io.to(x.id).emit("ans", currGame.players.filter(y => y.id == socket.client.id)[0].id);
            });
            games = games.filter(x => x != currGame);
        }
    });

    //Handle chat

    socket.on('chat', (chat) => {
        var currGame = games.filter(game => game.players.filter(p => p.id == socket.client.id).length > 0)[0];
        if (currGame) {
            var index = games.indexOf(currGame);
            // Contact players
            games[index].chats.push({ text: chat, sender: currGame.players.filter(y => y.id == socket.client.id)[0] });
            currGame.players.forEach(x => {
                io.to(x.id).emit("chat", games[index].chats);
            });
        }
    });
});

// Start server on port env or 3000

http.listen(process.env.PORT || 3000, () => {
    console.log('listening on *:3000 ');
});
