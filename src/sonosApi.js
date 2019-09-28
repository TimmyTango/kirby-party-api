const axios = require('axios');

const sonos = axios.create({
    baseURL: 'http://localhost:5005/'
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
        const { data } = await sonos.get('Bathroom/state');
        return data;
    },
    getRandomTracks: async () => {
        const { data } = await sonos.get('Bathroom/queue');

        const indices = generateRandomIndices(4, data.length);
        return indices.map(index => {
            data[index].trackIndex = index + 1;
            return data[index];
        });
    },
    playSong: async index => {
        sonos.get('Bathroom/trackseek/' + index);
    },
    pause: () => {
        sonos.get('Bathroom/pauseall');
    },
    play: () => {
        sonos.get('Bathroom/resumeall');
    }
};
