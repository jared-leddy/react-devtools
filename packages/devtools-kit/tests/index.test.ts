import { DEVTOOLS_KIT_PACKAGE_NAME } from '../src/index.js';

describe('@devtools/kit', () => {
    it('imports the package entry point without throwing', () => {
        expect(DEVTOOLS_KIT_PACKAGE_NAME).toBe('@devtools/kit');
    });
});
