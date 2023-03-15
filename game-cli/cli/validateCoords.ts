
function parseCoordinates(coords) {
    return {
        row: coords[0].toUpperCase().charCodeAt(0) - 65,
        col: Number(coords.slice(1))
    }
}

function isCoordinateValid(coords, threshold) {
    if (!coords) {
        return false;
    }
    const { row, col } = parseCoordinates(coords);
    if (coords.length > 3   ||
        !/[1-9]+/.test(col) ||
        row > threshold     ||
        col > threshold - 1 ||
        row < 1             ||
        col < 1 ) {
        return false;
    }
    return true;
}

export {
    parseCoordinates,
    isCoordinateValid
};
