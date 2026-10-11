import { getContext, setContext } from 'svelte';
import type { Tracery } from './tracery.svelte';

const KEY = Symbol('tracery');
export const provideTracery = (app: Tracery) => setContext(KEY, app);
export const useTracery = () => getContext<Tracery>(KEY);
