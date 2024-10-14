import js from '@eslint/js';
import jasmine from 'eslint-plugin-jasmine';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 13,
            globals: {
                ...globals.node
            }
        }
    },
    {
        files: ['spec/**/*.js'],
        plugins: [jasmine]
    }
];
