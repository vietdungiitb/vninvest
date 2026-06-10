function toTimeValue(value) {
    return value instanceof Date ? value.getTime() : value;
}
function clampIndex(index, length) {
    if (!Number.isFinite(index)) {
        return 0;
    }
    return Math.min(Math.max(Math.trunc(index), 0), length);
}
function intervalForSpeed(speed, baseIntervalMs, maxIntervalMs) {
    if (speed === "max") {
        return maxIntervalMs;
    }
    return Math.max(16, Math.round(baseIntervalMs / speed));
}
export class BarReplayController {
    allData;
    currentIndex;
    speed;
    baseIntervalMs;
    maxIntervalMs;
    isPlaying = false;
    timer = null;
    listeners = new Set();
    constructor(options) {
        this.allData = [...options.allData];
        this.currentIndex = clampIndex(options.startIndex ?? this.allData.length, this.allData.length);
        this.speed = options.speed ?? 1;
        this.baseIntervalMs = options.baseIntervalMs ?? 1000;
        this.maxIntervalMs = options.maxIntervalMs ?? 16;
    }
    getState() {
        return {
            allData: this.allData,
            currentIndex: this.currentIndex,
            speed: this.speed,
            isPlaying: this.isPlaying,
            visibleData: this.getVisibleData(),
            currentBar: this.getCurrentBar(),
            progress: this.allData.length === 0 ? 0 : this.currentIndex / this.allData.length,
            canStepBack: this.currentIndex > 1,
            canStepForward: this.currentIndex < this.allData.length,
        };
    }
    getVisibleData() {
        return this.allData.slice(0, this.currentIndex);
    }
    getCurrentBar() {
        return this.currentIndex > 0 ? this.allData[this.currentIndex - 1] : undefined;
    }
    isPlayingNow() {
        return this.isPlaying;
    }
    getCurrentIndex() {
        return this.currentIndex;
    }
    getSpeed() {
        return this.speed;
    }
    setData(allData, startIndex = this.currentIndex) {
        this.allData = [...allData];
        const nextStartIndex = this.allData.length > 0 && startIndex <= 0 ? 1 : startIndex;
        this.currentIndex = clampIndex(nextStartIndex, this.allData.length);
        if (this.currentIndex >= this.allData.length) {
            this.clearTimer();
            this.isPlaying = false;
        }
        this.emit();
    }
    setSpeed(speed) {
        this.speed = speed;
        if (this.isPlaying) {
            this.restartTimer();
            return;
        }
        this.emit();
    }
    play() {
        if (this.isPlaying || this.allData.length === 0) {
            return;
        }
        if (this.currentIndex === 0) {
            this.currentIndex = 1;
        }
        if (this.currentIndex >= this.allData.length) {
            this.emit();
            return;
        }
        this.isPlaying = true;
        this.scheduleTimer();
        this.emit();
    }
    pause() {
        if (!this.isPlaying && this.timer === null) {
            return;
        }
        this.clearTimer();
        this.isPlaying = false;
        this.emit();
    }
    toggle() {
        if (this.isPlaying) {
            this.pause();
            return;
        }
        this.play();
    }
    stepForward() {
        this.pause();
        if (this.currentIndex >= this.allData.length) {
            return;
        }
        this.currentIndex = clampIndex(this.currentIndex + 1, this.allData.length);
        this.emit();
    }
    stepBack() {
        this.pause();
        if (this.currentIndex <= 1) {
            return;
        }
        this.currentIndex = clampIndex(this.currentIndex - 1, this.allData.length);
        this.emit();
    }
    jumpToIndex(barIndex) {
        this.currentIndex = clampIndex(barIndex + 1, this.allData.length);
        this.emit();
    }
    jumpToLatest() {
        this.currentIndex = this.allData.length;
        this.emit();
    }
    jumpToDate(date) {
        const targetTime = toTimeValue(date);
        const foundIndex = this.allData.findIndex((bar) => toTimeValue(bar.date) >= targetTime);
        this.currentIndex = foundIndex === -1 ? this.allData.length : foundIndex + 1;
        this.emit();
    }
    rewind() {
        this.pause();
        this.currentIndex = this.allData.length > 0 ? 1 : 0;
        this.emit();
    }
    dispose() {
        this.clearTimer();
        this.listeners.clear();
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => {
            this.listeners.delete(listener);
        };
    }
    tick() {
        if (this.currentIndex >= this.allData.length) {
            this.finish();
            return;
        }
        this.currentIndex = clampIndex(this.currentIndex + 1, this.allData.length);
        this.emit();
        if (this.currentIndex >= this.allData.length) {
            this.finish();
        }
    }
    finish() {
        this.clearTimer();
        this.isPlaying = false;
        this.emit();
    }
    scheduleTimer() {
        this.clearTimer();
        this.timer = setInterval(() => {
            this.tick();
        }, intervalForSpeed(this.speed, this.baseIntervalMs, this.maxIntervalMs));
    }
    restartTimer() {
        if (!this.isPlaying) {
            return;
        }
        this.scheduleTimer();
    }
    clearTimer() {
        if (this.timer === null) {
            return;
        }
        clearInterval(this.timer);
        this.timer = null;
    }
    emit() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
}
