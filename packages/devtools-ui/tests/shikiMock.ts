export async function codeToHtml(code: string, options: { lang?: string }) {
    if (options.lang === 'broken') {
        throw new Error('Unsupported language');
    }

    return `<pre class="shiki"><code>${code}</code></pre>`;
}
