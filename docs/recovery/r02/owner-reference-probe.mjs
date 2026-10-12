import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const files = readdirSync('_screenshots', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
        readdirSync(`_screenshots/${entry.name}`)
            .filter((name) => name.endsWith('.png'))
            .map((name) => `_screenshots/${entry.name}/${name}`)
    )
    .sort();
const images = [];
for (const file of files) {
    const metadata = await sharp(file).metadata();
    images.push({
        file,
        width: metadata.width,
        height: metadata.height,
        sha256: createHash('sha256').update(readFileSync(file)).digest('hex')
    });
}
const file = '_screenshots/vue/Screenshot 2026-10-10 at 01.16.18.png';
const { data, info } = await sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
function sample(x, y) {
    const offset = (y * info.width + x) * info.channels;
    return [...data.subarray(offset, offset + 3)];
}
assert.deepEqual(sample(600, 325), [65, 159, 105]);
assert.deepEqual(sample(600, 500), [18, 18, 18]);
const selectionYs = [];
for (let y = 217; y < 500; y++) {
    if (sample(600, y).join(',') === '65,159,105') selectionYs.push(y);
}
assert.equal(selectionYs[0], 315);
assert.equal(selectionYs.at(-1), 334);
assert.equal(selectionYs.length, 20);
console.log(
    JSON.stringify(
        {
            authority: 'Restored owner references, inspected all 18 images',
            coordinateSystem:
                'Original raster pixels, not assumed CSS or OS DPI conversion',
            images,
            measuredComponents: {
                file,
                contentBoundsExclusive: {
                    left: 0,
                    top: 167,
                    right: 1920,
                    bottom: 995
                },
                railBoundsExclusive: { left: 0, right: 50 },
                treeInteriorXInclusive: [50, 984],
                dividerX: 985,
                inspectorInteriorXInclusive: [986, 1918],
                toolbarBoundsYExclusive: [167, 217],
                searchInputBoundsApproximate: [58, 182, 952, 209],
                selectedRowYInclusive: [selectionYs[0], selectionYs.at(-1)],
                selectedRowHeightRasterPx: selectionYs.length,
                samples: [
                    [600, 325],
                    [600, 500],
                    [49, 500],
                    [985, 500],
                    [100, 182]
                ].map(([x, y]) => ({ x, y, rgb: sample(x, y) }))
            },
            otherManualAnnotations: {
                croppedFirstImage: {
                    time: '01.15.35',
                    contentTop: 84,
                    railVisibleWidth: 42,
                    warning:
                        'Different crop; do not infer a second rail design or browser zoom'
                },
                timeline: {
                    time: '01.16.50',
                    layerDividerX: 704,
                    selectedLayerBoundsApproximate: [65, 304, 689, 336]
                },
                routerInspector: { time: '01.16.58', detailDividerX: 798 },
                picker: {
                    time: '01.17.32',
                    panelContentTop: 595,
                    dialogBoundsApproximate: [720, 705, 1200, 885],
                    pageLabelBoundsApproximate: [0, 112, 142, 147]
                }
            },
            sourceOnly: {
                dataFontCssPx: 14,
                indentationCssPx: 15,
                note: 'From Vue utility/source; screenshot font family/zoom are not proven'
            },
            interactionLimits:
                'Still images prove depicted selections, disclosure and picker states, not keyboard, focus, drag, animation or teardown',
            privacy:
                'Original screenshots remain local user files; no browser chrome/tabs or private application screenshots redistributed'
        },
        null,
        4
    )
);
