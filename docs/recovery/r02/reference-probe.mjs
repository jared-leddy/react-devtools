import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const file = 'devtools/docs/public/features/components.png';
const { data, info } = await sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
const rgb = (x, y) => {
    const offset = (y * info.width + x) * info.channels;
    return [...data.subarray(offset, offset + 3)];
};
const sourceFiles = [
    'devtools/packages/client/src/App.vue',
    'devtools/packages/client/src/components/common/SideNav.vue',
    'devtools/packages/applet/src/modules/components/index.vue',
    'devtools/packages/applet/src/components/tree/TreeViewer.vue',
    'devtools/packages/client/uno.config.ts',
    'devtools/packages/applet/uno.config.ts',
    'devtools/packages/ui/theme/theme.ts'
];
console.log(
    JSON.stringify(
        {
            authority:
                'Secondary upstream documentation image, not owner screenshots',
            image: file,
            imageSha256: createHash('sha256')
                .update(readFileSync(file))
                .digest('hex'),
            width: info.width,
            height: info.height,
            coordinateSystem: 'Original raster pixels, top-left origin',
            manualAnnotations: {
                contentApproximateBounds: [70, 78, 2097, 1243],
                railApproximateX: [70, 171],
                treeInteriorX: [172, 1132],
                dividerX: [1133, 1134],
                inspectorInteriorX: [1135, 2095],
                inputApproximateBounds: [187, 110, 1068, 164]
            },
            samples: [
                { x: 300, y: 400, rgb: rgb(300, 400) },
                { x: 500, y: 258, rgb: rgb(500, 258) },
                { x: 500, y: 297, rgb: rgb(500, 297) }
            ],
            sourceMeasurements: {
                collapsedRailCssPx: 50,
                expandedRailCssPx: 250,
                railControlCssPx: 40,
                overflowItemCapacityCssPx: 45,
                indentationPerDepthCssPx: 15,
                baseIndentCssPx: 4,
                stateTextUtility: 'text-3.5',
                componentsStackingThresholdPaneCssPx: 700
            },
            scaleInference:
                '100 raster px rail / 50 source CSS px suggests 2x; not measured owner-image scale',
            sourceSha256: Object.fromEntries(
                sourceFiles.map((path) => [
                    path,
                    createHash('sha256')
                        .update(readFileSync(path))
                        .digest('hex')
                ])
            )
        },
        null,
        4
    )
);
