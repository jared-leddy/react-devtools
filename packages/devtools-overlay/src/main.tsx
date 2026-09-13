/* istanbul ignore file */
import { mountDevtoolsOverlay } from './mount';

if (typeof document !== 'undefined') {
    mountDevtoolsOverlay();
}
