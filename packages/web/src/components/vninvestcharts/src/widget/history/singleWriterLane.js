export function createSingleWriterLane() {
    const queue = [];
    let running = false;
    const drainQueue = () => {
        if (running) {
            return;
        }
        const next = queue.shift();
        if (!next) {
            return;
        }
        running = true;
        let output;
        try {
            output = next.writer();
        }
        catch (error) {
            next.reject(error);
            running = false;
            drainQueue();
            return;
        }
        Promise.resolve(output)
            .then((value) => {
            next.resolve(value);
        })
            .catch((error) => {
            next.reject(error);
        })
            .finally(() => {
            running = false;
            drainQueue();
        });
    };
    return {
        run(writer) {
            return new Promise((resolve, reject) => {
                queue.push({
                    writer: writer,
                    resolve: resolve,
                    reject,
                });
                drainQueue();
            });
        },
    };
}
