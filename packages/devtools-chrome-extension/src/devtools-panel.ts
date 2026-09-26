globalThis.dispatchEvent(
    new CustomEvent('__react_devtools_panel_ready__', {
        detail: {
            source: 'react-devtools-extension'
        }
    })
);

export {};
