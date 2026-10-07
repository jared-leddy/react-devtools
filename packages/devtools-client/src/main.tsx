import { mountDevToolsClient } from './mount';
import { initializeStandaloneDelivery } from './delivery';

const root = document.getElementById('root');

if (root) {
    mountDevToolsClient(root);
    void initializeStandaloneDelivery();
}
