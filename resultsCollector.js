// resultsCollector.js
const testResults = [];
let srCounter = 1;

function addResult(result) {
    testResults.push(result);
}

function getResults() {
    return testResults;
}

function getSrCounter() {
    return srCounter;
}
function incrementSrCounter() {
    srCounter++;
}

export {
    addResult,
    getResults,
    getSrCounter,
    incrementSrCounter
};
