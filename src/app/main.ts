import '../app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { Tracery } from './tracery.svelte';

const app = new Tracery();
mount(App, { target: document.getElementById('app')!, props: { app } });
void app.start().catch(e => { app.fatal = `Could not start Tracery: ${(e as Error).message}`; });
// A handle for debugging and automated checks in the browser console.
Object.assign(window, { tracery: app });
