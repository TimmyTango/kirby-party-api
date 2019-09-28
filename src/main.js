#!/usr/bin/env node
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const sonos = require('./sonosApi');
const util = require('./util');

let hasVoted = {};
let votes = [0, 0, 0, 0];
let state = null;
let choices = null;
const refreshSeconds = 1;

function getNextTrack() {
    const possibleChoices = util.getMaxIndices(votes);
    if (possibleChoices.length == 1) {
        return choices[possibleChoices[0]];
    } else {
        const winner = Math.floor(Math.random() * possibleChoices.length);
        return choices[possibleChoices[winner]];
    }
}

async function playNextTrack() {
    const next = getNextTrack();
    if (next.trackIndex) {
        sonos.playSong(next.trackIndex);
        choices = await sonos.getRandomTracks();
        hasVoted = {};
        votes = [0, 0, 0, 0];
        io.emit('update-choices', {
            tracks: choices,
            canVote: true
        });
    }
}

function handleTimeRemaining() {
    if (state.timeRemaining < refreshSeconds) {
        setTimeout(updateState, timeRemaining * 1000);
    }
}

async function updateState() {
    state = await sonos.getState();
    state.timeRemaining = state.currentTrack.duration - state.elapsedTime;
    io.emit('update-state', state);
    handleTimeRemaining();
}

async function main() {
    choices = await sonos.getRandomTracks();

    setInterval(updateState, refreshSeconds * 1000);
    updateState();

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
                canVote: !hasVoted[addr],
                votes
            });
        });
        socket.on('vote', index => {
            if (!hasVoted[addr] && index >= 0 && index < 4) {
                hasVoted[addr] = true;
                votes[index]++;
                io.emit('vote-cast', votes);
            }
            console.log(votes);
        });
    });

    http.listen(3005, function() {
        console.log('listening on *:3005');
    });
}

function isNextTrack(track) {
    const prev = state.nextTrack;
    if (prev.artist == track.artist && prev.title == track.title) {
        return true;
    }
    return false;
}

app.use(express.json());

let ignoreNextUpdate = false;

app.post('/', (req, res) => {
    const { type, data } = req.body;
    if (type === 'transport-state' && data.roomName === 'Bathroom' && isNextTrack(data.state.currentTrack)) {
        if (ignoreNextUpdate) {
            ignoreNextUpdate = false;
        } else {
            playNextTrack();
        }
    }
    res.send({});
});

app.get('/', (req, res) => {
    res.send('server is up');
});

main();
