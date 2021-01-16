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
var _ = require('lodash');
const { Random } = require("random-js");
const random = new Random(); // uses the nativeMath engine

// Variables and essentials

var lookingForGame = [];

var globalQuest = null;

var isInGame = false;

var currGame;

//Methods

function containsObject(obj, list) {

    var i;
    
    for (i = 0; i < list.length; i++) {
        if (list[i].id === obj.id) {
            return true;
        }
    }

    return false;

}

// Index

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {

    //Stat socket
    console.log(`${socket.client.id} connected`);
    console.log(lookingForGame);

    socket.broadcast.emit('connected');

    // Handle disconnect
    socket.on('disconnect', () => {

        //Debug
        console.log('user disconnected');
        
        // Handle useres leaving

        if (isInGame && lookingForGame.filter(user => user.id == socket.client.id)[0]) {

            // Contact players
            io.emit("left", `${lookingForGame.filter(user => user.id == socket.client.id)[0].name}`);

            // Remove user
            lookingForGame = lookingForGame.filter(user => user.id != socket.client.id);

            // The game un-continuable
            if (lookingForGame.length < 2) {

                //Contact players
                io.emit('vam', "stop");

                // Reset game

                isInGame = false;
                currGame = null;
                lookingForGame = [];
            
            }

        } else {

            // Filter users
            lookingForGame = lookingForGame.filter(user => user.id != socket.client.id);
        
        }

    });

    //Handle matchmaking

    socket.on('vam', (ime) => {

        //Handle user
        if (containsObject({ "id": socket.client.id, "name": ime }, lookingForGame)) {

            //User already in q
            console.log(`vam already has ${ime} in mind`);
            console.log(lookingForGame)
        
        } else {

            //Add player to q
            lookingForGame.push({ "id": socket.client.id, "name": ime });
            console.log(lookingForGame)

        }

        //Generate quest if players are ready
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
                        "d": Math.pow(b, 2) - (4 * a * c)
                    }
                }
            }

            //Set variables
            console.log(quest);
            globalQuest = quest;
            currGame = { "a": quest.a, "b": quest.b, "c": globalQuest.c };
            isInGame = true;

            //Contact users
            lookingForGame.forEach(element => {

                //Tell user new quest
                io.to(element.id).emit('vam', {
                    msg: "found",
                    currGame,
                    lookingForGame,
                    playerId: element.id
                });

            });

        } else if (isInGame) {
            lookingForGame.forEach(element => {

                io.to(element.id).emit("join", { "name": lookingForGame.filter(user => user.id == socket.client.id)[0].name, "id": lookingForGame.filter(user => user.id == socket.client.id)[0].id, "lookingForGame": lookingForGame });
                io.to(element.id).emit("vam", currGame);

            });
        }
    });

    // Handle answers

    socket.on('ans', (ans) => {

        //Check if the required data is here
        if (ans && globalQuest) {

            //Answer correct
            if (ans.d == globalQuest.d && ans.x1 == globalQuest.x1 && ans.x2 == globalQuest.x2 && lookingForGame.length > 1) {

                //Contact users
                io.emit('ans', lookingForGame.filter(user => user.id == socket.client.id)[0].name);
                io.emit('vam', "stop");

                //Reset
                globalQuest = null;
                isInGame = false;
                lookingForGame = [];

            } else {

                //Tell user that that is not the right answer
                io.to(socket.client.id).emit('error', "NO")

            }

        }

    });

    //Handle chat

    socket.on('chat', (chat) => {

        if (isInGame) {

            //Send message to everybody
            lookingForGame.forEach(element => {

                io.to(element.id).emit('chat', { senderId: lookingForGame.filter(user => user.id == socket.client.id)[0].id, sender: lookingForGame.filter(user => user.id == socket.client.id)[0].name, mes: chat});
            
            });

        }

    });

});

// Start server on port env or 3000

http.listen(process.env.PORT || 3000, () => {
    console.log('listening on *:3000 ');
});
