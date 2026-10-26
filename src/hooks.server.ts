import type { Handle } from '@sveltejs/kit/hooks';
import { withFirstFlag } from '#lib/server/first-flag.ts';

export const handle: Handle = ({ event, resolve }) => resolve(event, { transformPageChunk: ({ html }) => withFirstFlag(html) });
