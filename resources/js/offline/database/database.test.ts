import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseWorker } from '@/offline/database/database';

type WorkerConstruction = {
    source: string | URL;
    options?: WorkerOptions;
};

const workerConstructions: WorkerConstruction[] = [];

class WorkerStub {
    public constructor(source: string | URL, options?: WorkerOptions) {
        workerConstructions.push({ source, options });
    }
}

describe('createDatabaseWorker', () => {
    afterEach(() => {
        workerConstructions.length = 0;
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('loads a same-origin worker directly', () => {
        vi.stubGlobal('Worker', WorkerStub);

        createDatabaseWorker(
            'http://localhost:8000/assets/sqlite.worker.js',
            'http://localhost:8000',
        );

        expect(String(workerConstructions[0]?.source)).toBe(
            'http://localhost:8000/assets/sqlite.worker.js',
        );
        expect(workerConstructions[0]?.options).toEqual({
            type: 'module',
            name: 'offline-first-sqlite',
        });
    });

    it('bootstraps a cross-origin development worker from a blob', async () => {
        vi.stubGlobal('Worker', WorkerStub);
        const createObjectUrl = vi
            .spyOn(URL, 'createObjectURL')
            .mockReturnValue('blob:http://localhost:8000/sqlite-worker');
        const revokeObjectUrl = vi
            .spyOn(URL, 'revokeObjectURL')
            .mockImplementation(() => undefined);
        const workerUrl =
            'http://[::1]:5173/resources/js/offline/database/sqlite.worker.ts?worker_file&type=module';

        createDatabaseWorker(workerUrl, 'http://localhost:8000');

        expect(workerConstructions[0]).toEqual({
            source: 'blob:http://localhost:8000/sqlite-worker',
            options: {
                type: 'module',
                name: 'offline-first-sqlite',
            },
        });
        const bootstrap = createObjectUrl.mock.calls[0][0] as Blob;

        expect(await bootstrap.text()).toBe(
            `import ${JSON.stringify(workerUrl)};`,
        );
        expect(revokeObjectUrl).toHaveBeenCalledWith(
            'blob:http://localhost:8000/sqlite-worker',
        );
    });
});
