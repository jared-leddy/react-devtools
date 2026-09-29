export const useRouter = jest.fn(() => ({
    asPath: '/',
    pathname: '/',
    push: jest.fn(),
    query: {},
    replace: jest.fn(),
    route: '/'
}));
