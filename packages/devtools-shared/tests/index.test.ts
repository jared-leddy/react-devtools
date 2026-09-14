import { DEVTOOLS_SHARED_PACKAGE_NAME } from '../src/index.js';

describe('@devtools/shared', () => {
    it('imports the package entry point without throwing', () => {
        expect(DEVTOOLS_SHARED_PACKAGE_NAME).toBe('@devtools/shared');
    });
});
