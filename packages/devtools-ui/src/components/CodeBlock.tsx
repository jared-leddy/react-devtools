import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

export interface CodeBlockProps {
    className?: string;
    code: string;
    language?: string;
    theme?: 'dark' | 'light';
}

export function CodeBlock({
    className = '',
    code,
    language = 'tsx',
    theme = 'dark'
}: CodeBlockProps) {
    const [html, setHtml] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setHtml(null);

        codeToHtml(code, {
            lang: language,
            theme: theme === 'dark' ? 'github-dark' : 'github-light'
        })
            .then((highlighted) => {
                if (active) {
                    setHtml(highlighted);
                }
            })
            .catch(() => {
                if (active) {
                    setHtml(null);
                }
            });

        return () => {
            active = false;
        };
    }, [code, language, theme]);

    return (
        <div className={`dt-code-block ${className}`.trim()}>
            {html ? (
                <div
                    className="dt-code-block__highlight"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            ) : (
                <pre className="dt-code-block__fallback">
                    <code>{code}</code>
                </pre>
            )}
        </div>
    );
}
