import '@fontsource/jacquarda-bastarda-9';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/silkscreen/400.css';
import './ui/styles.css';
import './content';
import { App } from './ui/app';

const root = document.getElementById('app')!;
const app = new App(root);
// exposed for automated smoke tests and debugging
(window as unknown as { sanctumfall: App }).sanctumfall = app;
