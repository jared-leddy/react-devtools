// @docusaurus/module-type-aliases only declares ambient modules for
// `*.css`/`*.module.css` — this project also uses `.scss` (via
// docusaurus-plugin-sass), which needs the same treatment.
declare module '*.module.scss' {
    const classes: { readonly [key: string]: string };
    export default classes;
}

declare module '*.scss' {
    const src: string;
    export default src;
}
