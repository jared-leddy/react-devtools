export const useParams = jest.fn(() => ({}));
export const usePathname = jest.fn(() => '/');
export const useRouter = jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn()
}));
export const useSearchParams = jest.fn(() => new URLSearchParams());
export const useSelectedLayoutSegments = jest.fn(() => []);
