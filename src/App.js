#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');

const sonos = require('./sonosApi');
const util = require('./util');

class App {
    hasVoted = {};
    votes = [0, 0, 0, 0];
    refreshSeconds = 1;
    state;
    choices;
    handler;
    server;
    io;
    expectedNextTrack;
    ignoreNextStateHook = false;

    constructor() {
        this.updateState = this.updateState.bind(this);

        this.handler = express();
        this.server = http.createServer(this.handler);
        this.io = socketio(this.server);

        this.handler.use(cors());
        this.handler.use(express.json());

        this.handler.post('/', (req, res) => {
            const { type, data } = req.body;

            if (type === 'transport-state') {
                if (this.ignoreNextStateHook) {
                    this.ignoreNextStateHook = false;
                } else if (this.isNextTrack(data.state.currentTrack)) {
                    this.playNextTrack();
                    this.expectedNextTrack = data.state.nextTrack;
                }
            }
            res.send({});
        });

        this.handler.get('/', (req, res) => {
            res.send('server is up');
        });
    }

    getNextTrack() {
        const possibleChoices = util.getMaxIndices(this.votes);
        if (possibleChoices.length == 1) {
            return this.choices[possibleChoices[0]];
        } else {
            const winner = Math.floor(Math.random() * possibleChoices.length);
            return this.choices[possibleChoices[winner]];
        }
    }

    async playNextTrack() {
        try {
            const next = this.getNextTrack();
            if (next.trackIndex) {
                this.ignoreNextStateHook = true;
                sonos.playSong(next.trackIndex);
                this.choices = await sonos.getRandomTracks();
                if (this.choices) {
                    this.hasVoted = {};
                    this.votes = [0, 0, 0, 0];
                    this.io.emit('update-choices', {
                        tracks: this.choices,
                        canVote: true,
                        votes: this.votes
                    });
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    handleTimeRemaining() {
        if (this.state.timeRemaining < this.refreshSeconds) {
            setTimeout(this.updateState, this.state.timeRemaining * 1000);
        }
    }

    async updateState() {
        try {
            this.state = await sonos.getState();
            if (this.state) {
                this.state.timeRemaining = this.state.currentTrack.duration - this.state.elapsedTime;
                this.io.emit('update-state', this.state);
                this.handleTimeRemaining();
            }
        } catch (err) {
            console.error(err);
        }
    }

    isNextTrack(track) {
        return (this.expectedNextTrack.artist === track.artist && this.expectedNextTrack.title === track.title);
    }

    async start() {
        try {
            this.choices = await sonos.getRandomTracks();
    
            if (!this.choices) {
                console.log('Unable to get choices');
            } else {
                setInterval(this.updateState, this.refreshSeconds * 1000);
                await this.updateState();

                this.expectedNextTrack = this.state.nextTrack;
            
                console.log('state', this.state);
            
                this.io.on('connection', socket => {
                    const addr = socket.handshake.address;
                    console.log('a user connected', addr);
                    socket.on('generate-token', () => {
                        socket.emit('token-generated', Math.floor(Math.random() * 1000000));
                    });
                    socket.on('request-state', () => {
                        socket.emit('update-state', this.state);
                    });
                    socket.on('request-choices', token => {
                        let canVote = true;
                        if (token)
                            canVote = !this.hasVoted[token];
                        socket.emit('update-choices', {
                            tracks: this.choices,
                            canVote,
                            votes: this.votes
                        });
                    });
                    socket.on('vote', ({ index, token }) => {
                        if (!this.hasVoted[token] && index >= 0 && index < 4) {
                            this.hasVoted[token] = true;
                            this.votes[index]++;
                            this.io.emit('vote-cast', this.votes);
                        }
                        console.log(this.votes);
                    });
                });
            }
        
            this.server.listen(3005, function() {
                console.log('listening on *:3005');
            });
        } catch (err) {
            console.error(err);
        }
    }
}

module.exports = App;
