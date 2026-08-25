import type {
    OutboxMutation,
    PullResponse,
    PushResponse,
} from '@/offline/types/sync';

const syncBaseUrl = '/api/sync';
const requestTimeoutMilliseconds = 15_000;

export class SyncApiError extends Error {
    public constructor(
        message: string,
        public readonly status: number | null,
    ) {
        super(message);
        this.name = 'SyncApiError';
    }

    public isAuthenticationError(): boolean {
        return [401, 403, 419].includes(this.status ?? 0);
    }

    public isRetryable(): boolean {
        return (
            this.status === null || this.status >= 500 || this.status === 429
        );
    }
}

export class SyncApiClient {
    public async health(): Promise<void> {
        await requestJson(`${syncBaseUrl}/health`);
    }

    public async push(
        deviceId: string,
        mutations: readonly OutboxMutation[],
    ): Promise<PushResponse> {
        return requestJson<PushResponse>(`${syncBaseUrl}/push`, {
            method: 'POST',
            body: JSON.stringify({
                device_id: deviceId,
                mutations: mutations.map((mutation) => ({
                    id: mutation.id,
                    entity_type: mutation.entityType,
                    entity_id: mutation.entityId,
                    operation: mutation.operation,
                    base_version: mutation.baseVersion,
                    data: mutation.payload,
                })),
            }),
        });
    }

    public async pull(cursor: number, limit = 100): Promise<PullResponse> {
        const query = new URLSearchParams({
            cursor: String(cursor),
            limit: String(limit),
        });

        return requestJson<PullResponse>(
            `${syncBaseUrl}/pull?${query.toString()}`,
        );
    }
}

async function requestJson<Result = unknown>(
    url: string,
    init: RequestInit = {},
): Promise<Result> {
    const controller = new AbortController();
    const timeout = window.setTimeout(
        () => controller.abort(),
        requestTimeoutMilliseconds,
    );
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    if (init.body) {
        headers.set('Content-Type', 'application/json');
        const csrfToken = csrfCookie();

        if (csrfToken) {
            headers.set('X-XSRF-TOKEN', csrfToken);
        }
    }

    try {
        const response = await fetch(url, {
            ...init,
            headers,
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') ?? '';
        const body = contentType.includes('application/json')
            ? ((await response.json()) as unknown)
            : null;

        if (!response.ok) {
            throw new SyncApiError(
                responseMessage(body) ??
                    `Sync request failed (${response.status}).`,
                response.status,
            );
        }

        if (body === null) {
            throw new SyncApiError(
                'The server returned an unexpected sync response.',
                response.status,
            );
        }

        return body as Result;
    } catch (error) {
        if (error instanceof SyncApiError) {
            throw error;
        }

        const message =
            error instanceof DOMException && error.name === 'AbortError'
                ? 'The sync request timed out.'
                : 'Laravel could not be reached.';

        throw new SyncApiError(message, null);
    } finally {
        window.clearTimeout(timeout);
    }
}

function csrfCookie(): string | null {
    const cookie = document.cookie
        .split('; ')
        .find((candidate) => candidate.startsWith('XSRF-TOKEN='));

    return cookie
        ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length))
        : null;
}

function responseMessage(body: unknown): string | null {
    if (
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof body.message === 'string'
    ) {
        return body.message;
    }

    return null;
}
