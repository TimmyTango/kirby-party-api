module.exports = {
    getMaxIndices: arr => {
        const max = Math.max(...arr);
        const indices = [];
        arr.map((v, i) => {
            if (v === max) {
                indices.push(i);
            }
        });
        return indices;
    }
};
