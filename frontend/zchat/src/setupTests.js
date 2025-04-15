import '@testing-library/jest-dom'


global.WebSocket = class {
    constructor() {
        this.onopen = jest.fn();
        this.onclose = jest.fn();
        this.onmessage = jest.fn();
        this.onerror = jest.fn();
        this.send = jest.fn();
        this.close = jest.fn();
    }

    static OPEN = 1;
};