import js from '@eslint/js';
import jasmine from 'eslint-plugin-jasmine';
import globals from 'globals';

export default [
    js.configs.recommended,
    jasmine.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 13,
            globals: {
                ...globals.node,
                ...globals.jasmine
            }
        },
        plugins: {
            jasmine
        },
        rules: {
            'jasmine/new-line-before-expect': 'off'
        }
    }
];
