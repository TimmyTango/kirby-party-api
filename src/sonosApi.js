const axios = require('axios');
const { roomName, sonosApiUrl } = require('./config');

const sonos = axios.create({
    baseURL: sonosApiUrl
    // baseURL: 'http://tango.tplinkdns.com:5005/'
});

function generateRandomIndices(numOfIndices, maxIndex) {
    if (numOfIndices == 0 || maxIndex == 0) {
        return [];
    }

    const indices = [];
    let cutoff = 0;
    while (indices.length < numOfIndices) {
        if (++cutoff > numOfIndices ** 3) {
            break;
        }

        const i = Math.floor(Math.random() * maxIndex);
        if (indices.includes(i)) {
            if (numOfIndices >= maxIndex) {
                indices.push(i);
            } else {
                continue;
            }
        } else {
            indices.push(i);
        }
    }
    return indices;
}

module.exports = {
    getState: async () => {
        try {
            const { data } = await sonos.get(`${roomName}/state`);
            return data;
        } catch (err) {
            console.error(err);
            return null;
        }
    },
    getRandomTracks: async () => {
        try {
            const { data } = await sonos.get(`${roomName}/queue`);
    
            const indices = generateRandomIndices(4, data.length);
            return indices.map(index => {
                data[index].trackIndex = index + 1;
                return data[index];
            });
        } catch (err) {
            console.error(err);
            return null;
        }
    },
    playSong: async index => {
        try {
            sonos.get(`${roomName}/trackseek/${index}`);
        } catch (err) {
            console.error(err);
        }
    },
    pause: () => {
        sonos.get(`${roomName}/pauseall`);
    },
    play: () => {
        sonos.get(`${roomName}/resumeall`);
    }
};
