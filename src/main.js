const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const sonos = require('./sonosApi');

let hasVoted = {};
let votes = [0, 0, 0, 0];
let state = null;
let choices = null;

async function resync() {
    state = await sonos.getState();
    io.emit('update-state', state);
}

async function main() {
    state = await sonos.getState();
    choices = await sonos.getRandomTracks();

    setInterval(resync, 3000);

    console.log('state', state);

    io.on('connection', socket => {
        const addr = socket.handshake.address;
        console.log('a user connected', addr);
        socket.on('request-state', () => {
            socket.emit('update-state', state);
        });
        socket.on('request-choices', () => {
            socket.emit('update-choices', {
                tracks: choices,
                canVote: !hasVoted[addr]
            });
        });
        socket.on('vote', index => {
            console.log(index);
            if (!hasVoted[addr] && index >= 0 && index < 4) {
                hasVoted[addr] = true;
                votes[index]++;
                socket.emit('vote-cast');
            }
            console.log(votes);
        });
    });

    http.listen(3000, function() {
        console.log('listening on *:3000');
    });
}

main();
