test('CI rejects a deliberately failing test during gate verification', () => {
    expect(true).toBe(false);
});
