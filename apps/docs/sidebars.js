// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
    docs: [
        'intro',
        {
            type: 'category',
            label: 'Getting Started',
            link: {
                type: 'doc',
                id: 'getting-started/overview'
            },
            items: ['getting-started/overview']
        },
        {
            type: 'category',
            label: 'Architecture',
            link: {
                type: 'doc',
                id: 'architecture/overview'
            },
            items: ['architecture/overview']
        },
        {
            type: 'category',
            label: 'Plugin Authoring',
            link: {
                type: 'doc',
                id: 'plugin-authoring/overview'
            },
            items: ['plugin-authoring/overview']
        },
        {
            type: 'category',
            label: 'Delivery Modes',
            link: {
                type: 'doc',
                id: 'delivery-modes/overview'
            },
            items: [
                'delivery-modes/overview',
                'delivery-modes/vite-plugin',
                'delivery-modes/extension'
            ]
        },
        {
            type: 'category',
            label: 'Nekuta Module',
            link: {
                type: 'doc',
                id: 'nekuta-module/overview'
            },
            items: ['nekuta-module/overview']
        }
    ]
};

module.exports = sidebars;
